import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  base: "./",
  server: {
    allowedHosts: ["frontend-dev", "frontend-e2e"],
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
