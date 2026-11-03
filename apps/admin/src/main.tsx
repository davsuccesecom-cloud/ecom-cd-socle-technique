import "./firebaseConfig"; // doit s'exécuter avant tout usage de @ecomcod/shared
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { registerSW } from "virtual:pwa-register";

// Sécurité anti-écran noir sur mise à jour Vite/PWA :
// Quand une nouvelle version est déployée avec de nouveaux hash de fichiers,
// toute tentative de chargement d'un ancien chunk déclenche "vite:preloadError".
// On force le rechargement immédiat pour charger la nouvelle version sans écran noir.
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[Vite] Chunk obsolète détecté suite à une mise à jour, rechargement automatique...", event);
  window.location.reload();
});

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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
