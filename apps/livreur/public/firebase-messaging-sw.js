// Ce fichier doit rester à la racine de public/ (portée requise par FCM).
// Reçoit les notifications push en arrière-plan pour l'app Livreur.

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
  authDomain: "meta-capi-app.firebaseapp.com",
  projectId: "meta-capi-app",
  storageBucket: "meta-capi-app.firebasestorage.app",
  messagingSenderId: "972779076968",
  appId: "1:972779076968:web:d682a4902fd83891a82add",
});

const messaging = firebase.messaging();

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
  const title = payload.data?.title || payload.notification?.title || (wl?.brandName ? `${wl.brandName} — Livreur` : "WariTrack — Livreur");
  const body = payload.data?.body || payload.notification?.body || "";
  const orderId = payload.data?.orderId || "";
  const targetUrl = payload.data?.url || (orderId ? `/?orderId=${orderId}` : "/");
  const icon = wl?.logoUrl || "/icons/icon-192.png";
  const tag = orderId ? `waritrack-order-${orderId}` : `waritrack-livreur-${Date.now()}`;

  try {
    await self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icons/badge-96.png",
      tag,
      renotify: true,
      data: { orderId, url: targetUrl },
    });
  } catch {
    await self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag,
      renotify: true,
      data: { orderId, url: targetUrl },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  const targetUrl = event.notification.data?.url || (orderId ? `/?orderId=${orderId}` : "/");

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
