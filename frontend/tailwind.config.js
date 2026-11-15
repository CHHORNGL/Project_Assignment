/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", ".dark-mode"],
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      spacing: {
        "68": "17rem",
        sidebar: "15.875rem",
      },
      colors: {
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
          soft: "#eef2ff",
          emerald: "#10b981",
        },
        phoenix: {
          primary: "#3874ff",
          primaryDark: "#004dff",
          primarySoft: "#e5edff",
          canvas: "#f5f7fa",
          subtle: "#eff2f6",
          border: "#cbd0dd",
          line: "#e3e6ed",
          body: "#31374a",
          muted: "#525b75",
          soft: "#8a94ad",
          darkCanvas: "#0f111a",
          darkSurface: "#141824",
          darkElevated: "#181d2b",
          darkBorder: "#373e53",
          darkLine: "#2b3245",
          success: "#25b003",
          warning: "#e5780b",
          danger: "#fa3b1d",
        },
        obsidian: {
          950: "#070b14",
          900: "#0c1220",
          850: "#11192b",
          800: "#182238",
        },
      },
      boxShadow: {
        panel: "0 18px 45px -24px rgba(15, 23, 42, 0.22)",
        glass: "0 24px 64px -20px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(148, 163, 184, 0.12)",
        glow: "0 0 36px -8px rgba(99, 102, 241, 0.45)",
      },
      fontFamily: {
        sans: ["Inter", "Kantumruy Pro", "Noto Sans Khmer", "system-ui", "-apple-system", "sans-serif"],
        body: ["Inter", "Kantumruy Pro", "Noto Sans Khmer", "system-ui", "-apple-system", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "Kantumruy Pro", "Noto Sans Khmer", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        khmer: ["Kantumruy Pro", "Noto Sans Khmer", "Inter", "sans-serif"],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translate3d(0, 12px, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translate3d(0, 4px, 0)" },
          "100%": { opacity: "1", transform: "scale(1) translate3d(0, 0, 0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translate3d(18px, 0, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translate3d(0, -8px, 0)" },
          "100%": { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "progress-fill": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "70%": { transform: "scale(1.12)", opacity: "0" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.38s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.25s ease-out both",
        "scale-in": "scale-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right": "slide-in-right 0.32s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 0.26s cubic-bezier(0.16, 1, 0.3, 1) both",
        "progress-fill": "progress-fill 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
      },
    },
  },
  plugins: [],
};
