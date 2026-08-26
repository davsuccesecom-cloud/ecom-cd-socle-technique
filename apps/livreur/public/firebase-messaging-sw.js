// Ce fichier doit rester a la racine de public/ (portee requise par FCM).
// Recoit les notifications push en arriere-plan pour l'app Livreur.

importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Valeurs publiques par nature (config Web app Firebase).
firebase.initializeApp({
  apiKey: "AIzaSyBaH9nab7GenUzF_tHuDwQOPhAUGQH-oWU",
  authDomain: "meta-capi-app.firebaseapp.com",
  projectId: "meta-capi-app",
  storageBucket: "meta-capi-app.firebasestorage.app",
  messagingSenderId: "972779076968",
  appId: "1:972779076968:web:d682a4902fd83891a82add",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Ecom COD — Livreur", {
    body: body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
});
