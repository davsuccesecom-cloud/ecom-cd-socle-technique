import { useEffect } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";

export function useRegisterPushNotifications(
  workspaceId: string,
  userId: string,
  vapidKey: string
) {
  useEffect(() => {
    if (!("Notification" in window)) {
      console.warn("useRegisterPushNotifications: Notification non supportee par ce navigateur.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      console.warn("useRegisterPushNotifications: serviceWorker non supporte par ce navigateur.");
      return;
    }

    let cancelled = false;

    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) {
        console.warn("useRegisterPushNotifications: messaging non disponible.");
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        console.log("useRegisterPushNotifications: permission notification refusee.");
        return;
      }

      try {
        const swRegistration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/firebase-cloud-messaging-push-scope" }
        );

        if (cancelled) return;

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swRegistration,
        });

        if (!token || cancelled) return;

        const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
        await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        console.log("useRegisterPushNotifications: token FCM enregistre avec succes.");
      } catch (err) {
        console.error("useRegisterPushNotifications: erreur lors de l'enregistrement du token FCM:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, vapidKey]);
}