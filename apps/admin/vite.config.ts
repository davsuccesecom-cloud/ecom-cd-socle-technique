import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Voir architecture section 3.1 — manifest + service worker générés
// automatiquement, condition pour que Chrome propose une VRAIE installation.
// Thème sombre ici (contrairement à closeuse/livreur) pour matcher la
// maquette validée par l'utilisateur pour l'app Admin.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ecom COD — Admin",
        short_name: "Admin",
        description: "Pilotage du business COD",
        theme_color: "#0B0D10",
        background_color: "#0B0D10",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        // Force le nouveau service worker a prendre le controle
        // immediatement (sans attendre la fermeture complete de l'app,
        // ce qui n'arrive quasiment jamais sur mobile) et nettoie les
        // vieux caches. Corrige le probleme "il faut vider le cache
        // pour voir les mises a jour".
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
