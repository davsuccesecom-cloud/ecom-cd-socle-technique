import { useEffect } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";

/**
 * Demande la permission de notification au premier chargement (si pas deja
 * repondu), enregistre EXPLICITEMENT le service worker firebase-messaging-sw.js
 * (evite tout conflit avec un autre service worker de l'app, ex: celui
 * genere par le plugin PWA), recupere le token FCM de l'appareil, et l'ajoute
 * a la liste des tokens de l'utilisateur.
 *
 * `vapidKey` vient de Firebase Console -> Cloud Messaging -> Certificats
 * push web.
 */
export function useRegisterPushNotifications(
  workspaceId: string,
  userId: string,
  vapidKey: string
) {
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") return;

      // Enregistrement EXPLICITE du service worker FCM, avec un scope
      // dedie, pour eviter tout conflit avec un autre service worker
      // (ex: celui genere par le plugin PWA de l'app).
      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );

      if (cancelled) return;

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration,
      }).catch((err) => {
        console.error("useRegisterPushNotifications: getToken a echoue:", err);
        return null;
      });

      if (!token || cancelled) return;

      const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
      await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, vapidKey]);
}