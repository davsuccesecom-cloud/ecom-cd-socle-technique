import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "notification-ping.mp3"],
      manifest: {
        id: "/",
        start_url: "/",
        scope: "/",
        name: "WariTrack — Closeuse",
        short_name: "Closeuse",
        description: "Gestion des commandes COD et qualification WhatsApp",
        theme_color: "#4F46E5",
        background_color: "#F8FAFC",
        display: "standalone",
        launch_handler: {
          client_mode: "navigate-existing",
        },
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["/firebase-messaging-sw.js"],
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,mp3}"],
        globIgnores: ["**/firebase-messaging-sw.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/__/, /^\/firebase-messaging-sw\.js$/, /\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/react-dom") || id.includes("/node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) {
            return "vendor-firebase";
          }
          if (id.includes("/node_modules/lucide-react")) {
            return "vendor-lucide";
          }
        },
      },
    },
  },
});
