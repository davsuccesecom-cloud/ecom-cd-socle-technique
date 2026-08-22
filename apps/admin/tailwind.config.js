/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette sombre validée sur la maquette de référence (fond quasi
        // noir, cartes légèrement plus claires, accents saturés par module).
        surface: {
          DEFAULT: "#0B0D10",
          raised: "#14171C",
          border: "#22262D",
        },
        brand: {
          DEFAULT: "#3B82F6",
          light: "#1D2333",
        },
        accent: {
          blue: "#3B82F6",
          green: "#22C55E",
          red: "#EF4444",
          orange: "#F97316",
          purple: "#8B5CF6",
          cyan: "#06B6D4",
        },
        status: {
          nouveau: "#4F46E5",
          programme: "#F59E0B",
          enCours: "#0EA5E9",
          livre: "#16A34A",
          rejete: "#EF4444",
          injoignable: "#DC2626",
          indisponible: "#6B7280",
        },
      },
    },
  },
  plugins: [],
};
