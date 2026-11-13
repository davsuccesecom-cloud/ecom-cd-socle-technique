/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          subtle: "var(--surface-subtle)",
          border: "var(--surface-border)",
        },
        accent: {
          red: "#EF4444",
        },
        brand: {
          DEFAULT: "var(--brand)",
          light: "var(--brand-light)",
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
