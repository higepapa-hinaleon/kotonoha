import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "kotonohaChatSDK",
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: [],
    },
  },
});
