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
// On protège contre les boucles de rafraîchissement avec un cooldown de 15 secondes.
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[Vite] Chunk obsolète détecté suite à une mise à jour :", event);
  try {
    const lastReload = sessionStorage.getItem("waritrack_last_preload_reload");
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
      sessionStorage.setItem("waritrack_last_preload_reload", String(now));
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

// Enregistrement PWA propre
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("[PWA] Nouvelle version prête.");
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update().catch(() => {});
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
