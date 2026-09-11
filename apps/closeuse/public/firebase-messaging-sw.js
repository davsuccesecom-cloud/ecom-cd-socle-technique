// Ce fichier doit rester à la racine de public/ (portée requise par FCM).
// Il tourne séparément du service worker PWA généré par vite-plugin-pwa,
// et gère spécifiquement la réception des notifications en arrière-plan
// (architecture section 3.2).

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Ces valeurs sont publiques par nature (config Web app Firebase), donc
// pas besoin de variable d'environnement ici — remplace-les avec les
// mêmes valeurs que ton .env.local une fois le projet Firebase connecté.
firebase.initializeApp({
  apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
  authDomain: "meta-capi-app.firebaseapp.com",
  projectId: "meta-capi-app",
  storageBucket: "meta-capi-app.firebasestorage.app",
  messagingSenderId: "972779076968",
  appId: "1:972779076968:web:5d27459e5bbb30dba82add",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Ecom COD — Nouvelle commande";
  const body = payload.notification?.body || payload.data?.body || "";
  const orderId = payload.data?.orderId || "";
  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    image: "/icons/icon-512.png",
    data: { orderId, url: orderId ? `/?orderId=${orderId}` : "/" },
  });
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

