import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["kpi.internal", "localhost"],
    hmr: {
      clientPort: 443,
      protocol: "wss",
      host: "kpi.internal",
    },
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://api:8000",
        changeOrigin: true,
      },
    },
  },
});
