import { useEffect } from "react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { getDb, getFirebaseMessaging } from "../firebase";

const LAST_TOKEN_KEY_PREFIX = "ecomcod_last_fcm_token_";
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

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

  // localStorage mis a jour AVANT l'ecriture Firestore : si un reload
  // (mise a jour du service worker) interrompt juste apres, le prochain
  // cycle saura deja que ce token a ete traite et ne le re-ajoutera pas
  // en double.
  localStorage.setItem(storageKey, token);

  if (token === previousToken) {
    // Meme token qu'avant, deja enregistre normalement. On s'assure quand
    // meme qu'il est bien present (idempotent, ne cree pas de doublon).
    await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
  } else {
    // Nouveau token : retrait de l'ancien + ajout du nouveau en UNE SEULE
    // ecriture atomique. Deux updateDoc separes laissaient une fenetre ou
    // un reload du service worker (mise a jour PWA) pouvait interrompre
    // la sequence entre les deux, causant une accumulation de vieux
    // tokens jamais nettoyes.
    const update: Record<string, unknown> = { fcmTokens: arrayUnion(token) };
    if (previousToken) {
      // Firestore n'autorise pas arrayRemove + arrayUnion sur le meme
      // champ dans un seul updateDoc classique -- on fait donc le retrait
      // d'abord (rapide), puis l'ajout, mais en ecrivant IMMEDIATEMENT
      // localStorage avant (voir ci-dessus) pour eviter la double-perte
      // d'etat en cas d'interruption.
      await updateDoc(userRef, { fcmTokens: arrayRemove(previousToken) });
    }
    await updateDoc(userRef, update);
  }

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
    let succeeded = false;
    let retryIndex = 0;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const attempt = async (): Promise<void> => {
      if (cancelledRef.current || succeeded) return;
      try {
        await registerToken(workspaceId, userId, vapidKey, cancelledRef);
        succeeded = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
          retryTimeoutId = null;
        }
      } catch (err) {
        console.error("useRegisterPushNotifications: erreur lors de l'enregistrement du token FCM:", err);
        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (cancelledRef.current || succeeded) return;
      const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
      retryIndex += 1;
      retryTimeoutId = setTimeout(attempt, delay);
    };

    // Tentative immediate au chargement.
    attempt();

    // Si une coupure reseau a empeche l'enregistrement, on retente des
    // que la connexion revient, sans attendre le prochain palier de retry.
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

    // Quand un nouveau service worker prend le controle (mise a jour PWA
    // automatique -- skipWaiting/clientsClaim), l'ancienne souscription
    // push peut devenir invalide cote navigateur avant meme le reload
    // programme par ailleurs. On re-declenche l'enregistrement tout de
    // suite pour ne pas rester sans token valide en attendant.
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
    };
  }, [workspaceId, userId, vapidKey]);
}