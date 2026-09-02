import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    /* En développement, /api/ora est relayé vers le service qui détient la clé. */
    proxy: { "/api": { target: process.env.ORA_SERVICE || "http://localhost:8787", changeOrigin: true } },
  },
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs"] },
} as Parameters<typeof defineConfig>[0]);
