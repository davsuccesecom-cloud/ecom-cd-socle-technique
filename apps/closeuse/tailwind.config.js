/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#FFFFFF",
          raised: "#FFFFFF",
          border: "#E5E7EB",
        },
        accent: {
          red: "#EF4444",
        },
        brand: {
          DEFAULT: "#4F46E5",
          light: "#EEF2FF",
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
