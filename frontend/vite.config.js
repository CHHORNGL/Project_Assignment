import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../backend/app/static/diagnosis-wizard",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: "./src/diagnosis-main.tsx",
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
