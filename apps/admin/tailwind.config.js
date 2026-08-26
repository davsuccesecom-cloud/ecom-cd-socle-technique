/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surface/brand pilotés par variables CSS (voir index.css) pour
        // permettre le bascule mode clair/sombre sans dupliquer la config.
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          border: "var(--surface-border)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          light: "var(--brand-light)",
        },
        // Palette alignée sur la charte visuelle de référence.
        accent: {
          blue: "#3B82F6",
          green: "#10B981",
          red: "#EF4444",
          orange: "#F59E0B",
          purple: "#8B5CF6",
          cyan: "#06B6D4",
        },
        status: {
          nouveau: "#4F46E5",
          programme: "#F59E0B",
          enCours: "#0EA5E9",
          livre: "#10B981",
          rejete: "#EF4444",
          injoignable: "#DC2626",
          indisponible: "#6B7280",
        },
      },
    },
  },
  plugins: [],
};
