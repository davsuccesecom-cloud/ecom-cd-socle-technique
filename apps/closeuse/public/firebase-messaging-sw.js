// 1. Enregistrement PRIORITAIRE du listener de clic pour focaliser instantanment la PWA installe
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

      // 1. Chercher immdiatement une fentre active de l'application
      let targetClient = windowClients.find(
        (c) => c.url && (c.url.startsWith(self.location.origin) || c.url.includes("waritrack"))
      );

      if (!targetClient && windowClients.length > 0) {
        targetClient = windowClients[0];
      }

      // 2. Si trouve, la focaliser IMMDIATEMENT pour conserver le geste utilisateur natif
      if (targetClient && "focus" in targetClient) {
        if (orderId) {
          targetClient.postMessage({ type: "NAVIGATE_ORDER", orderId, url: targetUrl });
        }
        return await targetClient.focus();
      }

      // 3. Si aucune fentre n'est ouverte : ouvrir la PWA installe
      if (clients.openWindow) {
        return await clients.openWindow(targetUrl);
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
    (wl?.brandName ? `${wl.brandName} — Closeuse` : "WariTrack — Closeuse");
  const body = payload?.notification?.body || payload?.data?.body || "";
  const orderId = payload?.data?.orderId || "";
  const targetUrl = toAbsolute(payload?.data?.url || (orderId ? `/?orderId=${orderId}` : "/"));
  const icon = resolveSafeIcon(wl?.logoUrl, toAbsolute("/icons/app-closeuse-native.png"));
  const badge = toAbsolute("/icons/badge-96.png");

  // N'afficher de grande image / bannire QUE s'il s'agit d'une vraie image produit en HTTP/HTTPS
  const rawImage = payload?.notification?.image || payload?.data?.image || payload?.data?.productImageUrl;
  const hasProductImage =
    typeof rawImage === "string" &&
    rawImage.startsWith("http") &&
    !rawImage.includes("waritrack-brand-banner");
  const image = hasProductImage ? rawImage : undefined;

  const tag = payload?.data?.tag || (orderId ? `waritrack-order-${orderId}` : `waritrack-closeuse-${Date.now()}`);

  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: true,
    data: { orderId, url: targetUrl },
    ...(image ? { image } : {}),
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
