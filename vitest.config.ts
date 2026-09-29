import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], testTimeout: 10000, hookTimeout: 10000, pool: "forks", maxWorkers: 1, minWorkers: 1, teardownTimeout: 1000, exclude: ["**/company.server.test.ts", "**/platform.server.test.ts", "**/tavily.server.test.ts", "**/banner-agent.functions.test.ts"] },
});
