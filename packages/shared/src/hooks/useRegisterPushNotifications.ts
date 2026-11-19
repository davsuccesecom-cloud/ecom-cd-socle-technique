import { useCallback, useEffect, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";
import type { IncomingPushDetail } from "./useNotifications";
import { triggerSystemNotification } from "../utils/systemNotification";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const PUSH_SW_PATH = "/firebase-messaging-sw.js";
const LEGACY_PUSH_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

function isAppleWebKitBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || /^((?!chrome|android).)*safari/i.test(ua);
}

function resolveSafeNotificationIcon(logoUrl?: string | null): string {
  if (typeof logoUrl === "string" && logoUrl.startsWith("https://")) {
    return logoUrl;
  }
  return "/icons/icon-192.png";
}

async function readCachedWhiteLabelForSw(): Promise<{ logoUrl?: string | null; appTitle?: string } | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open("waritrack-whitelabel");
    const res = await cache.match("/whitelabel.json");
    if (!res) return null;
    return (await res.json()) as { logoUrl?: string | null; appTitle?: string };
  } catch {
    return null;
  }
}

async function registerToken(
  workspaceId: string,
  userId: string,
  vapidKey: string,
  cancelledRef: { current: boolean },
  askIfDefault: boolean
): Promise<{ ok: boolean; permission: NotificationPermission | "unsupported"; swRegistration?: ServiceWorkerRegistration }> {
  const messaging = await getFirebaseMessaging();
  if (!messaging || cancelledRef.current) {
    console.warn("useRegisterPushNotifications: messaging non disponible.");
    return { ok: false, permission: "Notification" in window ? Notification.permission : "unsupported" };
  }

  let permission = Notification.permission;
  if (permission === "default" && askIfDefault) {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }
  if (permission !== "granted") {
    return { ok: false, permission };
  }

  // 1. Nettoyer l'ancien enregistrement sous /firebase-cloud-messaging-push-scope s'il existe
  try {
    const legacyReg = await navigator.serviceWorker.getRegistration(LEGACY_PUSH_SW_SCOPE);
    if (legacyReg) {
      await legacyReg.unregister();
    }
  } catch {}

  // 2. Récupérer en priorité absolue l'enregistrement root PWA (scope: '/')
  let swRegistration: ServiceWorkerRegistration | undefined;
  try {
    const rootReg = await navigator.serviceWorker.getRegistration("/");
    if (rootReg && (rootReg.active || rootReg.installing || rootReg.waiting)) {
      swRegistration = rootReg;
    }
  } catch {}

  if (!swRegistration) {
    try {
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (readyReg) {
        swRegistration = readyReg;
      }
    } catch {}
  }

  // 3. Repli si aucune registration root n'est encore active
  if (!swRegistration) {
    try {
      swRegistration = await navigator.serviceWorker.register(PUSH_SW_PATH, {
        scope: "/",
        updateViaCache: "none",
      });
    } catch (err) {
      console.warn("useRegisterPushNotifications: enregistrement SW root repli:", err);
    }
  }

  if (swRegistration) {
    void swRegistration.update().catch(() => {});
  }

  if (cancelledRef.current) return { ok: false, permission };

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });
  if (!token || cancelledRef.current) return { ok: false, permission, swRegistration };

  const storageKey = `${LAST_TOKEN_KEY_PREFIX}${userId}`;
  const previousToken = localStorage.getItem(storageKey);

  const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
  localStorage.setItem(storageKey, token);

  if (token === previousToken) {
    await setDoc(
      userRef,
      { fcmTokens: arrayUnion(token), fcmUpdatedAt: Date.now() },
      { merge: true }
    );
  } else {
    if (previousToken) {
      try {
        await updateDoc(userRef, { fcmTokens: arrayRemove(previousToken) });
      } catch {
        // Ancien token ou document absent
      }
    }
    await setDoc(
      userRef,
      { fcmTokens: arrayUnion(token), fcmUpdatedAt: Date.now() },
      { merge: true }
    );
  }

  console.log("useRegisterPushNotifications: token FCM enregistré avec succès.");
  return { ok: true, permission, swRegistration };
}

export function useRegisterPushNotifications(
  workspaceId: string,
  userId: string,
  vapidKey: string
) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const swRegRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const succeededRef = useRef(false);

  const requestPushPermission = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported" as const;
    if (!workspaceId || !userId || !vapidKey) return Notification.permission;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        const res = await registerToken(workspaceId, userId, vapidKey, { current: false }, false);
        if (res.swRegistration) swRegRef.current = res.swRegistration;
        if (res.ok) succeededRef.current = true;
      }
      return result;
    } catch {
      return Notification.permission;
    }
  }, [workspaceId, userId, vapidKey]);

  useEffect(() => {
    if (!workspaceId || !userId || !vapidKey) return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const cancelledRef = { current: false };
    succeededRef.current = false;
    let retryIndex = 0;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeOnMessage: (() => void) | undefined;

    // Détection PWA autonome
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    // Annoncer périodiquement l'identité PWA au Service Worker
    const announceIdentity = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          reg.active?.postMessage({
            type: "WARITRACK_CLIENT_IDENTITY",
            isStandalone,
            href: window.location.href,
          });
        }
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "WARITRACK_CLIENT_IDENTITY",
            isStandalone,
            href: window.location.href,
          });
        }
      } catch {}
    };

    announceIdentity();
    const announceTimer = setInterval(announceIdentity, 20_000);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "CHECK_STANDALONE") {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ isStandalone });
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);

    // Support de Launch Queue pour Chromium PWA
    if ("launchQueue" in window && "setConsumer" in (window as any).launchQueue) {
      try {
        (window as any).launchQueue.setConsumer((launchParams: any) => {
          if (launchParams.targetURL) {
            try {
              const url = new URL(launchParams.targetURL);
              const orderId = url.searchParams.get("orderId");
              if (orderId) {
                window.dispatchEvent(
                  new CustomEvent("waritrack-navigate-order", { detail: { orderId } })
                );
              }
            } catch {}
          }
        });
      } catch {}
    }

    const attachForegroundListener = async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelledRef.current) return;
      unsubscribeOnMessage = onMessage(messaging, async (payload) => {
        const title = payload.notification?.title || payload.data?.title || "WariTrack";
        const body = payload.notification?.body || payload.data?.body || "";
        const orderId = payload.data?.orderId || "";
        const targetUrl = payload.data?.url || (orderId ? `/?orderId=${orderId}` : "/");
        const tag =
          payload.data?.tag ||
          (orderId ? `waritrack-order-${orderId}` : `waritrack-fg-${Math.floor(Date.now() / 1000)}`);

        // 1. Notifie l'interface ouverte via PushToast
        window.dispatchEvent(
          new CustomEvent<IncomingPushDetail>("waritrack-push-message", {
            detail: { title, body, orderId, source: "fcm" },
          })
        );

        // 2. Extraction stricte de l'image réelle du produit (aucun wallpaper générique)
        const rawImage = payload.data?.image || payload.notification?.image || payload.data?.productImageUrl;
        const validProductImage =
          typeof rawImage === "string" &&
          (rawImage.startsWith("http://") || rawImage.startsWith("https://")) &&
          !rawImage.includes("waritrack-brand-banner")
            ? rawImage
            : undefined;

        // 3. Notification OS native : seulement en arrière-plan OU s'il s'agit d'une vraie commande
        const isDocumentVisible = typeof document !== "undefined" && document.visibilityState === "visible";
        const isRealOrder = Boolean(orderId) || title.toLowerCase().includes("commande") || title.toLowerCase().includes("livraison");

        if (!isDocumentVisible || isRealOrder) {
          const wl = await readCachedWhiteLabelForSw();
          const icon = resolveSafeNotificationIcon(wl?.logoUrl);
          void triggerSystemNotification({
            title,
            body,
            icon,
            image: validProductImage,
            badge: "/icons/badge-96.png",
            requireInteraction: true,
            orderId,
            tag,
            url: targetUrl,
          });
        }
      });
    };

    const scheduleRetry = () => {
      if (cancelledRef.current || succeededRef.current) return;
      const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
      retryIndex += 1;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      retryTimeoutId = setTimeout(attempt, delay);
    };

    const attempt = async (): Promise<void> => {
      if (cancelledRef.current || succeededRef.current) return;
      try {
        const res = await registerToken(
          workspaceId,
          userId,
          vapidKey,
          cancelledRef,
          !isAppleWebKitBrowser()
        );
        if (cancelledRef.current) return;
        setPermission(res.permission);
        if (res.swRegistration) swRegRef.current = res.swRegistration;
        if (res.ok) {
          succeededRef.current = true;
          if (retryTimeoutId) {
            clearTimeout(retryTimeoutId);
            retryTimeoutId = null;
          }
        }
      } catch (err: any) {
        console.error("useRegisterPushNotifications: erreur lors de l'enregistrement du token FCM:", err);
        if (err?.name === "SecurityError" || String(err?.message || "").includes("redirect")) {
          return;
        }
        scheduleRetry();
      }
    };

    void attachForegroundListener();
    void attempt();

    const handleOnline = () => {
      if (!succeededRef.current) {
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
          retryTimeoutId = null;
        }
        void attempt();
      }
    };
    window.addEventListener("online", handleOnline);

    const handleResumeCheck = () => {
      if ("Notification" in window) {
        const currentPerm = Notification.permission;
        setPermission(currentPerm);
        if (currentPerm === "granted" && !succeededRef.current && document.visibilityState === "visible") {
          void attempt();
        }
      }
      announceIdentity();
    };
    window.addEventListener("focus", handleResumeCheck);
    document.addEventListener("visibilitychange", handleResumeCheck);

    const handleControllerChange = () => {
      succeededRef.current = false;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      retryIndex = 0;
      void attempt();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelledRef.current = true;
      clearInterval(announceTimer);
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleResumeCheck);
      document.removeEventListener("visibilitychange", handleResumeCheck);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [workspaceId, userId, vapidKey]);

  return { permission, requestPushPermission };
}
