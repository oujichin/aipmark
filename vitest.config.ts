import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Prisma v6 + Node 22 の #imports マップ問題を回避
      "@prisma/client": path.resolve(
        __dirname,
        "./node_modules/.prisma/client/index.js"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30000,
    // SQLiteは並行書き込みに弱いため、テストファイルを順次実行
    fileParallelism: false,
  },
});
