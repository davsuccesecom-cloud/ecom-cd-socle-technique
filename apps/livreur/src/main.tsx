import "./firebaseConfig";
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Avec skipWaiting/clientsClaim actives cote Workbox, le nouveau service
// worker prend le controle des qu'il est pret. On recharge alors la page
// pour que le JS en memoire (React, etc.) corresponde a la nouvelle
// version -- evite d'avoir a vider le cache manuellement a chaque mise
// a jour.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // SPA : naviguer entre les pages ne declenche jamais de vrai
    // rechargement, donc le navigateur ne revérifie jamais tout seul
    // si une nouvelle version du service worker existe. On force ce
    // check nous-memes, a intervalle regulier.
    setInterval(() => {
      registration.update();
    }, 5 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
