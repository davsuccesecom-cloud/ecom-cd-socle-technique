// Ce fichier doit rester à la racine de public/ (portée requise par FCM).
// Reçoit le résumé périodique admin et les alertes en arrière-plan.

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
  authDomain: "meta-capi-app.firebaseapp.com",
  projectId: "meta-capi-app",
  storageBucket: "meta-capi-app.firebasestorage.app",
  messagingSenderId: "972779076968",
  appId: "1:972779076968:web:0b3273a01644985aa82add",
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const rawData = event.notification.data || {};
  const fcmMsg = rawData.FCM_MSG || {};
  const fcmData = fcmMsg.data || {};
  const orderId = rawData.orderId || fcmData.orderId || "";
  const targetUrl =
    rawData.url ||
    fcmMsg.fcmOptions?.link ||
    fcmData.url ||
    (orderId ? `/?orderId=${orderId}` : "/");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if (orderId) {
            client.postMessage({ type: "NAVIGATE_ORDER", orderId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

const messaging = firebase.messaging();

function toAbsolute(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const origin = self.location.origin;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

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

messaging.onBackgroundMessage(async (payload) => {
  const wl = await getWhiteLabelBranding();
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    (wl?.brandName ? `${wl.brandName} — Admin` : "WariTrack — Admin");
  const body = payload?.notification?.body || payload?.data?.body || "";
  const orderId = payload?.data?.orderId || "";
  const targetUrl = payload?.data?.url || (orderId ? `/?orderId=${orderId}` : "/");
  const icon = resolveSafeIcon(wl?.logoUrl, toAbsolute("/icons/icon-192.png"));
  const badge = toAbsolute("/icons/badge-96.png");
  const image = toAbsolute(
    payload?.notification?.image ||
    payload?.data?.image ||
    "/icons/waritrack-brand-banner.jpg"
  );
  const tag = payload?.data?.tag || (orderId ? `waritrack-admin-order-${orderId}` : `waritrack-admin-${Date.now()}`);

  try {
    await self.registration.showNotification(title, {
      body,
      icon,
      image,
      badge,
      tag,
      renotify: true,
      requireInteraction: true,
      data: { orderId, url: targetUrl },
    });
  } catch {
    await self.registration.showNotification(title, {
      body,
      icon: toAbsolute("/icons/icon-192.png"),
      badge,
      tag,
      renotify: true,
      requireInteraction: true,
      data: { orderId, url: targetUrl },
    });
  }
});
