import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* VITE_ROUTER=hash signale un build fichier unique (artefact, .exe local,
   partage de recette) : il n'y a pas de serveur pour livrer les fragments
   chargés à la demande (jsPDF, ExcelJS…). Rollup les regroupe alors dans le
   fichier d'entrée, que scripts/single-file.mjs sait déjà intégrer en ligne. */
const ficheUnique = process.env.VITE_ROUTER === "hash";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    /* En développement, /api/ora est relayé vers le service qui détient la clé. */
    proxy: { "/api": { target: process.env.ORA_SERVICE || "http://localhost:8787", changeOrigin: true } },
  },
  build: ficheUnique ? { rollupOptions: { output: { inlineDynamicImports: true } } } : undefined,
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs"] },
} as Parameters<typeof defineConfig>[0]);
