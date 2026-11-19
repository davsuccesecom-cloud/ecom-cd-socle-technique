/**
 * Utilitaire universel et robuste pour l'émission de notifications système
 * (Windows Action Center, macOS Notification Center, Android).
 *
 * Élimine tout risque de deadlock (gel) lié à navigator.serviceWorker.ready
 * et force l'apparition visuelle de la bannière à l'écran via requireInteraction
 * et des URLs absolues exigées par Windows ShellExperienceHost.
 */

const PUSH_SW_PATH = "/firebase-messaging-sw.js";
const PUSH_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

export function toAbsoluteNotificationUrl(path?: string | null): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://waritrack-admin.vercel.app";
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

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
  image?: string;
  badge?: string;
  tag?: string;
  orderId?: string;
  url?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
}

/**
 * Déclenche une VRAIE notification système native qui surgit à l'écran sous Windows 11 / Android.
 * Exécute à la fois new Notification() dans le contexte actif et reg.showNotification() via le Service Worker.
 */
export async function triggerSystemNotification(options: ShowSystemNotificationOptions): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }

  if (permission !== "granted") {
    console.warn("[WariTrack Notification] Notification refusée car permission =", permission);
    return false;
  }

  // URLs absolues obligatoires pour que Windows 11 Action Center affiche les icônes et grandes images
  const icon = toAbsoluteNotificationUrl(options.icon || "/icons/icon-192.png");
  const badge = toAbsoluteNotificationUrl(options.badge || "/icons/badge-96.png");
  const image = toAbsoluteNotificationUrl(
    options.image || "/icons/waritrack-brand-banner.jpg"
  );
  const tag =
    options.tag ||
    (options.orderId ? `waritrack-order-${options.orderId}` : `waritrack-${Date.now()}`);
  const targetUrl = options.url || (options.orderId ? `/?orderId=${options.orderId}` : "/");

  let anyShown = false;

  // 1. Déclenchement direct dans la fenêtre (force l'apparition immédiate de la bannière toast à l'écran)
  try {
    const directNotif = new Notification(options.title, {
      body: options.body,
      icon,
      image,
      tag,
      requireInteraction: options.requireInteraction ?? true, // Force le toast à rester visible à l'écran
    } as any);

    directNotif.onclick = () => {
      window.focus();
      if (options.url) {
        window.location.href = options.url;
      }
      directNotif.close();
    };

    anyShown = true;
    console.log("[WariTrack Notification] Popup écran déclenché via new Notification()");
  } catch (err) {
    console.warn("[WariTrack Notification] Direct Notification avertissement:", err);
  }

  // 2. Déclenchement via Service Worker (assure l'enregistrement persistant dans le Centre de notifications Windows)
  try {
    const reg = await getSafeServiceWorkerRegistration();
    if (reg && "showNotification" in reg) {
      await reg.showNotification(options.title, {
        body: options.body,
        icon,
        image,
        badge,
        tag,
        renotify: options.renotify ?? true,
        requireInteraction: options.requireInteraction ?? true,
        data: {
          orderId: options.orderId,
          url: targetUrl,
        },
      } as any);
      anyShown = true;
      console.log("[WariTrack Notification] Notification enregistrée via Service Worker.");
    }
  } catch (err) {
    console.warn("[WariTrack Notification] ServiceWorker showNotification avertissement:", err);
  }

  return anyShown;
}
