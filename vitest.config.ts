import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts", "tests/security/**/*.test.ts"], env: { DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/app_db", ENABLE_TEST_FIXTURES: "true" } },
});
