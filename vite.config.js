import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    // `vercel dev` ke bina bhi local API chal sake, iske liye proxy:
    proxy: { "/api": "http://localhost:3001" },
  },
});
