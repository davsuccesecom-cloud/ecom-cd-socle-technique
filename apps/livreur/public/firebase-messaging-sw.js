// 1. Enregistrement PRIORITAIRE du listener de clic pour intercepter l'événement avant tout SDK tiers
const standaloneClients = new Set();

self.addEventListener("message", (event) => {
  if (event.data?.type === "WARITRACK_CLIENT_IDENTITY") {
    if (event.data.isStandalone && event.source?.id) {
      standaloneClients.add(event.source.id);
    } else if (event.data.isStandalone === false && event.source?.id) {
      standaloneClients.delete(event.source.id);
    }
  }
});

function toAbsolute(path) {
  if (!path) return self.location.origin + "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = self.location.origin;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();

  const rawData = event.notification.data || {};
  const fcmMsg = rawData.FCM_MSG || {};
  const fcmData = fcmMsg.data || {};
  const orderId = rawData.orderId || fcmData.orderId || "";
  const targetUrl = toAbsolute(
    rawData.url ||
    fcmData.url ||
    (orderId ? `/?orderId=${orderId}` : "/")
  );

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1. Chercher d'abord parmi les fenêtres déjà connues comme PWA autonome (standalone)
      let targetClient =
        windowClients.find((c) => c.url && c.url.includes("standalone=true")) ||
        windowClients.find((c) => standaloneClients.has(c.id));

      // 2. Si pas en mémoire, interroger rapidement chaque fenêtre via MessageChannel
      if (!targetClient && windowClients.length > 0) {
        for (const client of windowClients) {
          try {
            const messageChannel = new MessageChannel();
            const isSt = await new Promise((resolve) => {
              const timeout = setTimeout(() => resolve(false), 80);
              messageChannel.port1.onmessage = (msgEvent) => {
                clearTimeout(timeout);
                resolve(msgEvent.data?.isStandalone === true);
              };
              client.postMessage({ type: "CHECK_STANDALONE" }, [messageChannel.port2]);
            });
            if (isSt) {
              standaloneClients.add(client.id);
              targetClient = client;
              break;
            }
          } catch {}
        }
      }

      // 3. Si toujours non trouvé, cibler une fenêtre visible ou de même origine
      if (!targetClient && windowClients.length > 0) {
        targetClient =
          windowClients.find((c) => c.url.startsWith(self.location.origin) && c.visibilityState === "visible") ||
          windowClients.find((c) => c.url.startsWith(self.location.origin)) ||
          windowClients[0];
      }

      // 4. Si une fenêtre existante est trouvée, la focaliser SANS rechargement hard de page
      if (targetClient && "focus" in targetClient) {
        if (orderId) {
          targetClient.postMessage({ type: "NAVIGATE_ORDER", orderId, url: targetUrl });
        }
        return await targetClient.focus();
      }

      // 5. Si aucune fenêtre n'est ouverte : ouvrir l'application (en mode standalone PWA)
      if (clients.openWindow) {
        const pwaOpenUrl = targetUrl.includes("standalone=true")
          ? targetUrl
          : `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}standalone=true`;
        return await clients.openWindow(pwaOpenUrl);
      }
    })()
  );
});

// 2. Import et initialisation du SDK Firebase Cloud Messaging
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
    authDomain: "meta-capi-app.firebaseapp.com",
    projectId: "meta-capi-app",
    storageBucket: "meta-capi-app.firebasestorage.app",
    messagingSenderId: "972779076968",
    appId: "1:972779076968:web:7a41da103d1be9a9a82add",
  });
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

function resolveSafeIcon(url, fallback) {
  return typeof url === "string" && url.startsWith("https://") ? url : fallback;
}

async function getWhiteLabelBranding() {
  try {
    const cache = await caches.open("waritrack-whitelabel");
    const res = await cache.match("/whitelabel.json");
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
  const wl = await getWhiteLabelBranding();
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    (wl?.brandName ? `${wl.brandName} — Livreur` : "WariTrack — Livreur");
  const body = payload?.notification?.body || payload?.data?.body || "";
  const orderId = payload?.data?.orderId || "";
  const targetUrl = toAbsolute(payload?.data?.url || (orderId ? `/?orderId=${orderId}` : "/"));
  const icon = resolveSafeIcon(wl?.logoUrl, toAbsolute("/icons/app-livreur-native.png"));
  const badge = toAbsolute("/icons/badge-96.png");
  const image = toAbsolute(
    payload?.notification?.image ||
    payload?.data?.image ||
    payload?.data?.productImageUrl ||
    "/icons/app-livreur-native.png"
  );
  const tag = payload?.data?.tag || (orderId ? `waritrack-order-${orderId}` : `waritrack-livreur-${Date.now()}`);

  const notificationOptions = {
    body,
    icon,
    image,
    badge,
    tag,
    renotify: true,
    requireInteraction: true,
    data: { orderId, url: targetUrl },
  };

  try {
    await self.registration.showNotification(title, notificationOptions);
  } catch {
    await self.registration.showNotification(title, {
      ...notificationOptions,
      icon: toAbsolute("/icons/icon-192.png"),
    });
  }
});
