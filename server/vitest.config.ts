import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "src/db/seed.ts",
        "src/db/reset.ts",
        "src/db/migrate.ts",
        "src/emails/**",
        "src/index.ts",
        "**/*.test.ts",
        "dist/**",
      ],
    },
  },
});
