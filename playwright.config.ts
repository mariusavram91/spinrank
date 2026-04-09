import { defineConfig } from "@playwright/test";

const appBaseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:4173";
const workerBaseUrl = process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8787";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  workers: 1,
  use: {
    baseURL: appBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev -- --host 0.0.0.0 --port 4173 --mode test",
        env: {
          ...process.env,
          VITE_DEV_PROXY_TARGET: workerBaseUrl,
        },
        url: appBaseUrl,
        reuseExistingServer: !process.env.CI,
      },
});
