import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  base: "./",
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
