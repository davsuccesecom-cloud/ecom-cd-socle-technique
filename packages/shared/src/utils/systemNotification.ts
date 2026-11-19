/**
 * Utilitaire universel et robuste pour l'émission de notifications système
 * (Windows Action Center, macOS Notification Center, Android).
 *
 * Élimine tout risque de deadlock (gel) lié à navigator.serviceWorker.ready
 * en accédant directement aux inscriptions existantes via getRegistrations()
 * ou en enregistrant le Service Worker à la volée.
 */

const PUSH_SW_PATH = "/firebase-messaging-sw.js";
const PUSH_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

export async function getSafeServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // 1. Tenter d'abord de récupérer l'enregistrement FCM spécifique
  try {
    const fcmReg = await navigator.serviceWorker.getRegistration(PUSH_SW_SCOPE);
    if (fcmReg) return fcmReg;
  } catch {}

  // 2. Chercher parmi tous les Service Workers enregistrés sur cette origine
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs && regs.length > 0) {
      const activeReg = regs.find((r) => r.active) || regs[0];
      if (activeReg) return activeReg;
    }
  } catch {}

  // 3. Si aucun enregistrement n'existe encore, enregistrer à la volée sans bloquer
  try {
    const newReg = await navigator.serviceWorker.register(PUSH_SW_PATH, {
      scope: PUSH_SW_SCOPE,
      updateViaCache: "none",
    });
    return newReg;
  } catch (err) {
    console.warn("[WariTrack Notification] Échec enregistrement SW à la volée:", err);
  }

  return null;
}

export interface ShowSystemNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  orderId?: string;
  url?: string;
  renotify?: boolean;
}

/**
 * Déclenche une notification système native (qui s'affiche dans le Centre de notifications Windows 11).
 * Tente d'abord via Service Worker (requis par Windows Action Center pour persister),
 * puis se replie sur new Notification() si nécessaire.
 */
export async function triggerSystemNotification(options: ShowSystemNotificationOptions): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("[WariTrack Notification] Notification refusée car permission =", Notification.permission);
    return false;
  }

  const icon = options.icon || "/icons/icon-192.png";
  const badge = options.badge || "/icons/badge-96.png";
  const tag =
    options.tag ||
    (options.orderId ? `waritrack-order-${options.orderId}` : `waritrack-${Date.now()}`);
  const targetUrl = options.url || (options.orderId ? `/?orderId=${options.orderId}` : "/");

  let shown = false;

  // Étape 1 : Notification via Service Worker (obligatoire pour Windows Action Center)
  try {
    const reg = await getSafeServiceWorkerRegistration();
    if (reg && "showNotification" in reg) {
      await reg.showNotification(options.title, {
        body: options.body,
        icon,
        badge,
        tag,
        renotify: options.renotify ?? true,
        data: {
          orderId: options.orderId,
          url: targetUrl,
        },
      } as any);
      shown = true;
      console.log("[WariTrack Notification] Notification affichée via Service Worker avec succès.");
    }
  } catch (err) {
    console.warn("[WariTrack Notification] Erreur showNotification SW:", err);
  }

  // Étape 2 : Repli via new Notification si showNotification a échoué
  if (!shown) {
    try {
      new Notification(options.title, {
        body: options.body,
        icon,
        tag,
      });
      shown = true;
      console.log("[WariTrack Notification] Notification affichée via fallback new Notification().");
    } catch (err) {
      console.warn("[WariTrack Notification] Erreur fallback new Notification():", err);
    }
  }

  return shown;
}
