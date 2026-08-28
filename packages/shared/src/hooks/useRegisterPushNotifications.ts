import { useEffect } from "react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";

async function registerToken(
  workspaceId: string,
  userId: string,
  vapidKey: string,
  cancelledRef: { current: boolean }
) {
  const messaging = await getFirebaseMessaging();
  if (!messaging || cancelledRef.current) {
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

  const swRegistration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/firebase-cloud-messaging-push-scope" }
  );
  if (cancelledRef.current) return;

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });
  if (!token || cancelledRef.current) return;

  const storageKey = `${LAST_TOKEN_KEY_PREFIX}${userId}`;
  const previousToken = localStorage.getItem(storageKey);

  const userRef = doc(getDb(), "workspaces", workspaceId, "users", userId);

  if (previousToken && previousToken !== token) {
    // Le navigateur a genere un nouveau token (cache vide, reinstall PWA, etc.)
    // On retire l'ancien pour eviter les envois en double sur ce meme appareil.
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(previousToken),
    });
  }

  await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
  localStorage.setItem(storageKey, token);
  console.log("useRegisterPushNotifications: token FCM enregistre avec succes.");
}

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

    const cancelledRef = { current: false };

    (async () => {
      try {
        await registerToken(workspaceId, userId, vapidKey, cancelledRef);
      } catch (err) {
        console.error("useRegisterPushNotifications: erreur lors de l'enregistrement du token FCM:", err);
        // Nouvelle tentative unique apres un court delai : certaines erreurs
        // (ex. "installations/request-failed") sont transitoires (reseau,
        // service temporairement indisponible) et reussissent au 2e essai
        // sans attendre que l'utilisateur recharge la page manuellement.
        setTimeout(async () => {
          if (cancelledRef.current) return;
          try {
            await registerToken(workspaceId, userId, vapidKey, cancelledRef);
          } catch (retryErr) {
            console.error("useRegisterPushNotifications: echec de la 2e tentative:", retryErr);
          }
        }, 5000);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [workspaceId, userId, vapidKey]);
}