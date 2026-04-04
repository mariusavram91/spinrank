import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    setupFiles: ["tests/setup/global.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts", "worker/src/**/*.ts"],
    },
  },
  projects: [
    {
      name: "node",
      test: {
        include: ["tests/unit/**", "tests/integration/**"],
        exclude: ["tests/unit/frontend/**"],
        environment: "node",
      },
    },
    {
      name: "jsdom",
      test: {
        include: ["tests/unit/frontend/**"],
        environment: "jsdom",
      },
    },
  ],
});
