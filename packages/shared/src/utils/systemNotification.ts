/**
 * Utilitaire universel et robuste pour l'émission de notifications système
 * (Windows Action Center, macOS Notification Center, Android).
 *
 * Élimine tout risque de deadlock (gel) lié à navigator.serviceWorker.ready
 * et force l'apparition visuelle de la bannière à l'écran via requireInteraction
 * et des URLs absolues exigées par Windows ShellExperienceHost.
 * Priorise la PWA installée pour ne jamais ouvrir un onglet externe du navigateur.
 */

const PUSH_SW_PATH = "/firebase-messaging-sw.js";
const LEGACY_PUSH_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

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

  // 1. Nettoyer tout ancien enregistrement isolé sur le sub-scope FCM
  try {
    const legacyReg = await navigator.serviceWorker.getRegistration(LEGACY_PUSH_SW_SCOPE);
    if (legacyReg) {
      await legacyReg.unregister();
    }
  } catch {}

  // 2. Tenter d'abord de récupérer l'enregistrement Root PWA (scope: '/')
  try {
    const rootReg = await navigator.serviceWorker.getRegistration("/");
    if (rootReg && (rootReg.active || rootReg.installing || rootReg.waiting)) {
      return rootReg;
    }
  } catch {}

  // 3. Attendre navigator.serviceWorker.ready sans bloquer indéfiniment
  try {
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (readyReg) return readyReg;
  } catch {}

  // 4. Chercher parmi tous les Service Workers enregistrés sur cette origine
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs && regs.length > 0) {
      const activeReg = regs.find((r) => r.active) || regs[0];
      if (activeReg) return activeReg;
    }
  } catch {}

  // 5. Si aucun enregistrement n'existe encore, enregistrer le SW PWA à la racine
  try {
    const newReg = await navigator.serviceWorker.register(PUSH_SW_PATH, {
      scope: "/",
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

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://"));

  // 1. Déclenchement direct dans la fenêtre PWA
  // IMPORTANT: Si la page tourne dans un simple onglet de navigateur Chrome, on ne doit JAMAIS
  // créer de new Notification() car son clic forcerait Chrome à revenir au premier plan au lieu de la PWA !
  // Seul le Service Worker doit émettre pour toujours router vers l'application PWA installée.
  if (isStandalone) {
    try {
      const directNotif = new Notification(options.title, {
        body: options.body,
        icon,
        image,
        tag,
        requireInteraction: options.requireInteraction ?? true,
      } as any);

      directNotif.onclick = () => {
        window.focus();

        if (options.orderId) {
          window.dispatchEvent(
            new CustomEvent("waritrack-navigate-order", {
              detail: { orderId: options.orderId },
            })
          );
          window.dispatchEvent(
            new MessageEvent("message", {
              data: { type: "NAVIGATE_ORDER", orderId: options.orderId, url: targetUrl },
            })
          );
        }

        if (options.url) {
          try {
            const currentPath = window.location.pathname + window.location.search;
            const parsed = options.url.startsWith("http") ? new URL(options.url) : null;
            const targetPath = parsed ? parsed.pathname + parsed.search : options.url;
            if (currentPath !== targetPath) {
              window.history.pushState({}, "", options.url);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          } catch {
            window.location.href = options.url;
          }
        }

        directNotif.close();
      };

      anyShown = true;
      console.log("[WariTrack Notification] Popup écran déclenché dans la PWA installée");
    } catch (err) {
      console.warn("[WariTrack Notification] Direct Notification avertissement:", err);
    }
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
