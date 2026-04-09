import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  base: "./",
  server: {
    allowedHosts: ["frontend-dev", "frontend-e2e", "clan-arabia-monitors-printed.trycloudflare.com"],
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
