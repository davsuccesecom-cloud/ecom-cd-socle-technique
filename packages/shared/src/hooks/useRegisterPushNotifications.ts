import { useEffect } from "react";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";

/**
 * Demande la permission de notification au premier chargement (si pas déjà
 * répondu), récupère le token FCM de l'appareil, et l'ajoute à la liste des
 * tokens de l'utilisateur (section 3.2 — un employé peut avoir plusieurs
 * appareils, donc on ajoute plutôt que remplacer).
 *
 * `vapidKey` vient de Firebase Console → Cloud Messaging → Certificats
 * push web.
 */
export function useRegisterPushNotifications(
  workspaceId: string,
  userId: string,
  vapidKey: string
) {
  useEffect(() => {
    if (!("Notification" in window)) return;

    let cancelled = false;

    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") return;

      const token = await getToken(messaging, { vapidKey }).catch(() => null);
      if (!token || cancelled) return;

      const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
      await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, vapidKey]);
}
