import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../app/static/diagnosis-wizard",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: "./src/diagnosis-main.jsx",
      output: {
        entryFileNames: "diagnosis-wizard.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "diagnosis-wizard.css";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
