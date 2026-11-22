import "./firebaseConfig"; // doit s'exécuter avant tout usage de @ecomcod/shared
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { registerSW } from "virtual:pwa-register";

// Enregistrement PWA avec mise à jour automatique sans bloquer la closeuse
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true).then(() => {
      window.location.reload();
    }).catch(() => {
      window.location.reload();
    });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    });
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
