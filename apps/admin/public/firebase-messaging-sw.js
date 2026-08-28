// Ce fichier doit rester à la racine de public/ (portée requise par FCM).
// Reçoit le résumé périodique admin en arrière-plan (architecture section 5.1 / 3.2).

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Valeurs publiques par nature (config Web app Firebase) — remplace avec
// les mêmes valeurs que ton .env.local une fois le projet Firebase connecté.
firebase.initializeApp({
  apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
  authDomain: "meta-capi-app.firebaseapp.com",
  projectId: "meta-capi-app",
  storageBucket: "meta-capi-app.firebasestorage.app",
  messagingSenderId: "972779076968",
  appId: "1:972779076968:web:0b3273a01644985aa82add",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.data ?? {};
  self.registration.showNotification(title ?? "Ecom COD — Admin", {
    body: body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    image: "/icons/icon-512.png",
  });
});
