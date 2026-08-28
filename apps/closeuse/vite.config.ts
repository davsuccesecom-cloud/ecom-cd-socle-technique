import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Voir architecture section 3.1 — manifest + service worker générés
// automatiquement, condition pour que Chrome propose une VRAIE installation
// (pas juste un raccourci avec badge Chrome visible).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ecom COD — Closeuse",
        short_name: "Closeuse",
        description: "Gestion des commandes COD",
        theme_color: "#4F46E5",
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
        // Nécessaire pour recevoir les notifications FCM même app fermée
        // (section 3.2) — le service worker Firebase Messaging est séparé,
        // voir public/firebase-messaging-sw.js
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
    }),
  ],
});
