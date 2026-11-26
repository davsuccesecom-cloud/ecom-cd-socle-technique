import "./firebaseConfig"; // doit s'exécuter avant tout usage de @ecomcod/shared
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import SecurityShield from "./components/SecurityShield";
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

// Purge automatique du cache navigateur sur chaque nouveau déploiement :
// Évite à l'administrateur de devoir forcer le rafraîchissement ("Ctrl + Shift + R")
const APP_BUILD_VERSION = "waritrack-v2026.11.26.4-ai-cfo-dopage";
try {
  const currentVersion = localStorage.getItem("waritrack_pwa_version");
  if (currentVersion !== APP_BUILD_VERSION) {
    localStorage.setItem("waritrack_pwa_version", APP_BUILD_VERSION);
    if ("caches" in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((name) => {
          if (!name.includes("firebase")) {
            caches.delete(name);
          }
        });
      });
    }
  }
} catch {}

// Écoute de prise de contrôle par un nouveau Service Worker : recharge immédiate transparente
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Enregistrement PWA avec mise à jour automatique sans bloquer l'administrateur
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        window.location.reload();
      });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Vérification fréquente pour capter instantanément tout nouveau déploiement
    setInterval(() => {
      registration.update().catch(() => {});
    }, 15 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    });
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityShield>
        <App />
      </SecurityShield>
    </ErrorBoundary>
  </React.StrictMode>
);
