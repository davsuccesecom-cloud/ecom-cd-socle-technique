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
      alert("DIAGNOSTIC: Notification non supportee par ce navigateur.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      alert("DIAGNOSTIC: serviceWorker non supporte par ce navigateur.");
      return;
    }
    let cancelled = false;
    (async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging || cancelled) {
        alert("DIAGNOSTIC: getFirebaseMessaging() a retourne null. Arret ici.");
        return;
      }

      let permission = Notification.permission;
      alert("DIAGNOSTIC: permission actuelle = " + permission);

      if (permission === "default") {
        permission = await Notification.requestPermission();
        alert("DIAGNOSTIC: permission apres demande = " + permission);
      }
      if (permission !== "granted") {
        alert("DIAGNOSTIC: permission refusee, arret. Valeur = " + permission);
        return;
      }

      try {
        const swRegistration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/firebase-cloud-messaging-push-scope" }
        );
        alert("DIAGNOSTIC: service worker enregistre avec succes.");

        if (cancelled) return;

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swRegistration,
        });

        alert("DIAGNOSTIC: token obtenu = " + (token ? token.substring(0, 20) + "..." : "NULL"));

        if (!token || cancelled) return;

        const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);
        await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
        alert("DIAGNOSTIC: token sauvegarde dans Firestore avec succes !");
      } catch (err) {
        alert("DIAGNOSTIC: ERREUR = " + String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId, vapidKey]);
}