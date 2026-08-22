// Ce fichier doit rester à la racine de public/ (portée requise par FCM).
// Reçoit le résumé périodique admin en arrière-plan (architecture section 5.1 / 3.2).

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Valeurs publiques par nature (config Web app Firebase) — remplace avec
// les mêmes valeurs que ton .env.local une fois le projet Firebase connecté.
firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Ecom COD — Admin", {
    body: body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
});
