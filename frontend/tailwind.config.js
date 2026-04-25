/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16a34a",
          dark: "#15803d",
          soft: "#dcfce7",
        },
      },
      boxShadow: {
        panel: "0 18px 45px -24px rgba(15, 23, 42, 0.22)",
      },
      fontFamily: {
        body: ["Inter", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
        khmer: ["Kantumruy Pro", "Noto Sans Khmer", "sans-serif"],
      },
    },
  },
  plugins: [],
};
