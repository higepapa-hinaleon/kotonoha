import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "kotonohaChatWidget",
      formats: ["es"],
      fileName: "kotonoha-chat-widget",
    },
    rollupOptions: {
      // SDK をバンドルに含める（外部依存なしの単一ファイル配布）
      external: [],
    },
  },
});
