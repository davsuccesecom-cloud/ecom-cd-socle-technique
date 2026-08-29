import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ecom COD — Livreur",
        short_name: "Livreur",
        description: "Suivi des livraisons COD",
        theme_color: "#0EA5E9",
        background_color: "#F8FAFC",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
