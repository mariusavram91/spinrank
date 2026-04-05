import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    setupFiles: ["tests/setup/global.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts", "worker/src/**/*.ts"],
      thresholds: {
        statements: 36,
        branches: 66,
        functions: 86,
        lines: 36,
      },
    },
    include: ["tests/unit/**", "tests/integration/**"],
    exclude: ["tests/e2e/**", "node_modules/**", "worker/node_modules/**"],
    environment: "node",
    environmentMatchGlobs: [["tests/unit/frontend/**", "jsdom"]],
  },
});
