import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "~~": resolve(__dirname),
      "~~/": resolve(__dirname) + "/",
    },
  },
});
