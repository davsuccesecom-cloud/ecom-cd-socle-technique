import { useCallback, useEffect, useRef, useState } from "react";
import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";
import type { IncomingPushDetail } from "./useNotifications";
import { triggerSystemNotification } from "../utils/systemNotification";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";
const RETRY_DELAYS_MS = [4_000, 10_000, 25_000, 60_000];
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

/**
 * Obtient l'enregistrement Service Worker actif sans JAMAIS écraser sw.js (Workbox).
 * Dans une PWA Vite, /sw.js inclut déjà importScripts("/firebase-messaging-sw.js").
 * Écraser /sw.js avec /firebase-messaging-sw.js briserait la souscription WebPush et révoquerait le token FCM.
 */
async function getActiveSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;

  // 1. Tenter d'abord de récupérer le SW root actif (scope '/')
  try {
    const rootReg = await navigator.serviceWorker.getRegistration("/");
    if (rootReg && (rootReg.active || rootReg.installing || rootReg.waiting)) {
      return rootReg;
    }
  } catch {}

  // 2. Attendre navigator.serviceWorker.ready (délai tolérant jusqu'à 3.5s)
  try {
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);
    if (readyReg) {
      return readyReg;
    }
  } catch {}

  // 3. Tenter de récupérer parmi toutes les registrations actives
  try {
    const allRegs = await navigator.serviceWorker.getRegistrations();
    if (allRegs.length > 0) {
      const active = allRegs.find((r) => r.active) || allRegs[0];
      return active;
    }
  } catch {}

  // 4. Repli si aucun service worker n'est enregistré (ex: dev mode ou premier lancement)
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch {
    try {
      const fbReg = await navigator.serviceWorker.register(PUSH_SW_PATH, { scope: "/" });
      return fbReg;
    } catch (err) {
      console.warn("useRegisterPushNotifications: impossible d'enregistrer un SW:", err);
    }
  }

  return undefined;
}

/**
 * Enregistrement, vérification et rotation résiliente du token FCM.
 * Comprend un mécanisme anti-zombie : si le token local a été élagué de Firestore (suite à un rejet FCM
 * ou nettoyage serveur), l'ancien token en IndexedDB est purgé et un nouveau token tout frais est demandé.
 */
async function registerToken(
  workspaceId: string,
  userId: string,
  vapidKey: string,
  cancelledRef: { current: boolean },
  askIfDefault: boolean,
  forceRefresh: boolean = false
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

  // 2. Obtenir l'enregistrement Service Worker actif sans collision
  const swRegistration = await getActiveSwRegistration();
  if (cancelledRef.current) return { ok: false, permission, swRegistration };

  if (swRegistration) {
    void swRegistration.update().catch(() => {});
  }

  const storageKey = `${LAST_TOKEN_KEY_PREFIX}${userId}`;
  const previousToken = localStorage.getItem(storageKey);

  // 3. Vérifier l'état réel des tokens dans Firestore
  const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
  let firestoreTokens: string[] = [];
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      firestoreTokens = userSnap.data()?.fcmTokens ?? [];
    }
  } catch (readErr) {
    console.warn("useRegisterPushNotifications: lecture Firestore:", readErr);
  }

  // 4. Détection anti-zombie : si le token local n'est plus présent dans Firestore
  // (pruné par Cloud Functions car déclaré mort par Google FCM), forcer une purge IndexedDB
  const isPrunedByBackend = Boolean(previousToken && !firestoreTokens.includes(previousToken));
  if (forceRefresh || isPrunedByBackend) {
    console.warn("[WariTrack Push] Token local pruné ou refresh forcé. Purge IndexedDB et renouvellement FCM...");
    try {
      await deleteToken(messaging);
    } catch (delErr) {
      console.warn("[WariTrack Push] deleteToken:", delErr);
    }
  }

  // 5. Récupération du token FCM (existant ou renouvelé)
  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });
  } catch (err: any) {
    console.error("useRegisterPushNotifications: erreur getToken:", err);
    // Si l'erreur indique une désynchronisation ou un token corrompu, purger et retenter immédiatement
    const errMsg = String(err?.message || "").toLowerCase();
    if (errMsg.includes("registration") || errMsg.includes("not-registered") || errMsg.includes("invalid")) {
      try {
        await deleteToken(messaging);
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swRegistration,
        });
      } catch (retryErr) {
        console.error("useRegisterPushNotifications: nouvelle tentative getToken échouée:", retryErr);
      }
    }
  }

  if (!token || cancelledRef.current) {
    return { ok: false, permission, swRegistration };
  }

  // 6. Sauvegarde et mise à jour Firestore & localStorage
  localStorage.setItem(storageKey, token);
  localStorage.setItem(`${storageKey}_synced_at`, String(Date.now()));

  // Si le token a changé sur cet appareil, retirer l'ancien token
  if (previousToken && previousToken !== token) {
    try {
      await updateDoc(userRef, { fcmTokens: arrayRemove(previousToken) });
    } catch {}
  }

  // Enregistrer le token valide dans Firestore avec métadonnées de fraîcheur
  await setDoc(
    userRef,
    {
      fcmTokens: arrayUnion(token),
      fcmUpdatedAt: Date.now(),
      fcmPlatform: "web_pwa",
      fcmLastSeen: Date.now(),
    },
    { merge: true }
  );

  console.log("useRegisterPushNotifications: token FCM opérationnel et synchronisé avec Firestore.");
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
        const res = await registerToken(workspaceId, userId, vapidKey, { current: false }, false, true);
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

        // 2. Extraction stricte de l'image réelle du produit
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

    const attempt = async (force: boolean = false): Promise<void> => {
      if (cancelledRef.current) return;
      try {
        const res = await registerToken(
          workspaceId,
          userId,
          vapidKey,
          cancelledRef,
          !isAppleWebKitBrowser(),
          force
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
    void attempt(false);

    const handleOnline = () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      void attempt(false);
    };
    window.addEventListener("online", handleOnline);

    // Vérification proactive au retour d'arrière-plan ou focus de l'app
    const handleResumeCheck = () => {
      if ("Notification" in window) {
        const currentPerm = Notification.permission;
        setPermission(currentPerm);
        if (currentPerm === "granted" && document.visibilityState === "visible") {
          const storageKey = `${LAST_TOKEN_KEY_PREFIX}${userId}`;
          const lastSynced = parseInt(localStorage.getItem(`${storageKey}_synced_at`) || "0", 10);
          const elapsed = Date.now() - lastSynced;
          // Vérifier si premier enregistrement non terminé OU si plus de 20 minutes depuis la dernière synchronisation
          if (!succeededRef.current || elapsed > 20 * 60 * 1000) {
            void attempt(false);
          }
        }
      }
      announceIdentity();
    };
    window.addEventListener("focus", handleResumeCheck);
    document.addEventListener("visibilitychange", handleResumeCheck);

    // Heartbeat périodique (toutes les 15 minutes) tant que l'application est ouverte
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === "visible" && Notification.permission === "granted") {
        void attempt(false);
      }
    }, 15 * 60 * 1000);

    const handleForceReregister = () => {
      console.log("[WariTrack Push] Événement de renouvellement forcé reçu.");
      void attempt(true);
    };
    window.addEventListener("waritrack-push-reregister", handleForceReregister);

    const handleControllerChange = () => {
      succeededRef.current = false;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      retryIndex = 0;
      void attempt(false);
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelledRef.current = true;
      clearInterval(announceTimer);
      clearInterval(heartbeatTimer);
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleResumeCheck);
      window.removeEventListener("waritrack-push-reregister", handleForceReregister);
      document.removeEventListener("visibilitychange", handleResumeCheck);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [workspaceId, userId, vapidKey]);

  return { permission, requestPushPermission };
}
