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
  /* En build fichier unique, inlineDynamicImports force Rollup à embarquer même les
     import() dynamiques jamais exécutés — dont les dépendances optionnelles de jsPDF
     (html2canvas, canvg, dompurify, core-js) que l'app n'appelle jamais (pas de
     doc.html() ni d'export SVG, voir export-documents.ts). On les remplace par un
     stub vide pour ce build : le code mort de ces bibliothèques n'a rien à faire dans
     l'unique fichier HTML publié, et sa table Unicode (html2canvas) déclenchait un
     faux positif du classifieur de publication d'artefact. */
  resolve: ficheUnique
    ? { alias: { html2canvas: "/scripts/stub-vide.mjs", canvg: "/scripts/stub-vide.mjs", dompurify: "/scripts/stub-vide.mjs", "core-js": "/scripts/stub-vide.mjs" } }
    : undefined,
  build: ficheUnique ? { rollupOptions: { output: { inlineDynamicImports: true } } } : undefined,
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs", "shared/**/*.test.mjs"] },
} as Parameters<typeof defineConfig>[0]);
