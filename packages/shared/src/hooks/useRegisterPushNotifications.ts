import { useCallback, useEffect, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";
import type { IncomingPushDetail } from "./useNotifications";
import { triggerSystemNotification } from "../utils/systemNotification";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const PUSH_SW_PATH = "/firebase-messaging-sw.js";
const PUSH_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

function isAppleWebKitBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || /^((?!chrome|android).)*safari/i.test(ua);
}

function resolveSafeNotificationIcon(logoUrl?: string | null): string {
  // Android NotificationManager, iOS WebKit et Windows Action Center rejettent ou
  // abandonnent silencieusement les data: URI volumineuses (ex. data:image/webp).
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

  const swRegistration = await navigator.serviceWorker.register(PUSH_SW_PATH, {
    scope: PUSH_SW_SCOPE,
    updateViaCache: "none",
  });
  void swRegistration.update().catch(() => {});
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

        // 2. Affiche systématiquement la notification OS native dans le Centre de notifications Windows / OS
        const wl = await readCachedWhiteLabelForSw();
        const icon = resolveSafeNotificationIcon(wl?.logoUrl);
        void triggerSystemNotification({
          title,
          body,
          icon,
          image: "/icons/waritrack-brand-banner.jpg",
          badge: "/icons/badge-96.png",
          requireInteraction: true,
          orderId,
          tag,
          url: targetUrl,
        });
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
