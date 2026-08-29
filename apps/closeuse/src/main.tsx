import "./firebaseConfig"; // doit s'exécuter avant tout usage de @ecomcod/shared
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
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
