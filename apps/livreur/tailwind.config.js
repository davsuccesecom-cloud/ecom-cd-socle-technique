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
          DEFAULT: "#0EA5E9",
          light: "#E0F2FE",
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
