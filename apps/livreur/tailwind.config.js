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
          recu: "#4F46E5",
          enRoute: "#0EA5E9",
          livre: "#16A34A",
          injoignable: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
