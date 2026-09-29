import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist", sourcemap: false },
  server: {
    port: 5173,
    // Lets the local API run without `vercel dev`: /api is proxied to scripts/dev-api.js
    proxy: { "/api": "http://localhost:3001" },
  },
});
