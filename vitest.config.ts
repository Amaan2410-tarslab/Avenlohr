import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules/**", ".git/**", "e2e/**", "playwright-report/**", "test-results/**"],
  },
});
