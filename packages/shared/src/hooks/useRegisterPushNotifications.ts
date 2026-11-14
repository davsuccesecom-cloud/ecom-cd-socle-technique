import { useCallback, useEffect, useState } from "react";
import { arrayRemove, arrayUnion, doc, setDoc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";
import type { IncomingPushDetail } from "./useNotifications";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

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

  const swRegistration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/firebase-cloud-messaging-push-scope" }
  );
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

  const requestPushPermission = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported" as const;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await registerToken(workspaceId, userId, vapidKey, { current: false }, false);
      }
      return result;
    } catch {
      return Notification.permission;
    }
  }, [workspaceId, userId, vapidKey]);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const cancelledRef = { current: false };
    let succeeded = false;
    let retryIndex = 0;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let swRegRef: ServiceWorkerRegistration | undefined;
    let unsubscribeOnMessage: (() => void) | undefined;

    const attachForegroundListener = async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelledRef.current) return;
      unsubscribeOnMessage = onMessage(messaging, async (payload) => {
        const title = payload.notification?.title || payload.data?.title || "WariTrack";
        const body = payload.notification?.body || payload.data?.body || "";
        const orderId = payload.data?.orderId || "";

        // 1. Notifie l'interface ouverte via PushToast
        window.dispatchEvent(
          new CustomEvent<IncomingPushDetail>("waritrack-push-message", {
            detail: { title, body, orderId, source: "fcm" },
          })
        );

        // 2. Si la fenêtre n'a pas le focus ou est minimisée, affiche une vraie notification OS
        if (
          Notification.permission === "granted" &&
          swRegRef &&
          (document.visibilityState !== "visible" || !document.hasFocus())
        ) {
          const wl = await readCachedWhiteLabelForSw();
          const icon = wl?.logoUrl || "/icons/icon-192.png";
          const extraOpts = { renotify: true } as unknown as NotificationOptions;
          try {
            await swRegRef.showNotification(title, {
              body,
              icon,
              badge: "/icons/badge-96.png",
              tag: orderId ? `waritrack-order-${orderId}` : `waritrack-fg-${Date.now()}`,
              data: { orderId, url: orderId ? `/?orderId=${orderId}` : "/" },
              ...extraOpts,
            });
          } catch {
            await swRegRef.showNotification(title, {
              body,
              icon: "/icons/icon-192.png",
              badge: "/icons/badge-96.png",
              data: { orderId, url: orderId ? `/?orderId=${orderId}` : "/" },
            });
          }
        }
      });
    };

    const attempt = async (): Promise<void> => {
      if (cancelledRef.current || succeeded) return;
      try {
        const res = await registerToken(workspaceId, userId, vapidKey, cancelledRef, true);
        setPermission(res.permission);
        if (res.swRegistration) swRegRef = res.swRegistration;
        if (res.ok) {
          succeeded = true;
          if (retryTimeoutId) {
            clearTimeout(retryTimeoutId);
            retryTimeoutId = null;
          }
          await attachForegroundListener();
        }
      } catch (err: any) {
        console.error("useRegisterPushNotifications: erreur lors de l'enregistrement du token FCM:", err);
        if (err?.name === "SecurityError" || String(err?.message || "").includes("redirect")) {
          return;
        }
        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (cancelledRef.current || succeeded) return;
      const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
      retryIndex += 1;
      retryTimeoutId = setTimeout(attempt, delay);
    };

    attempt();

    const handleOnline = () => {
      if (!succeeded) {
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
          retryTimeoutId = null;
        }
        attempt();
      }
    };
    window.addEventListener("online", handleOnline);

    const handleControllerChange = () => {
      succeeded = false;
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      retryIndex = 0;
      attempt();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, [workspaceId, userId, vapidKey]);

  return { permission, requestPushPermission };
}
