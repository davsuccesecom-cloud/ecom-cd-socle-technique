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
      includeAssets: ["favicon.svg", "notification-ping.mp3"],
      manifest: {
        id: "/",
        start_url: "/",
        scope: "/",
        name: "WariTrack — Cockpit Admin",
        short_name: "WariTrack",
        description: "Cash & Logistics Operating System for Africa",
        theme_color: "#07090F",
        background_color: "#07090F",
        display: "standalone",
        display_override: ["standalone"],
        launch_handler: {
          client_mode: ["focus-existing", "auto"],
        },
        handle_links: "preferred",
        icons: [
          { src: "icons/waritrack-3d-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/waritrack-3d-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/waritrack-3d-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/waritrack-3d-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cacheId: "waritrack-admin-v5-live",
        importScripts: ["/firebase-messaging-sw.js"],
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,mp3}"],
        globIgnores: ["**/firebase-messaging-sw.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/__/, /^\/firebase-messaging-sw\.js$/, /\/api\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react-dom") || id.includes("/node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) {
            return "vendor-firebase";
          }
          if (id.includes("/node_modules/recharts") || id.includes("/node_modules/recharts/")) {
            return "vendor-recharts";
          }
          if (id.includes("/node_modules/lucide-react")) {
            return "vendor-lucide";
          }
        },
      },
    },
  },
});
