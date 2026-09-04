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
        skipWaiting: true,
        clientsClaim: true,
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

