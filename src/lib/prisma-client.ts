// Prisma v6 + Node 22 の #imports マップ問題を回避するために
// index.js を直接 require するラッパー
import path from "path";
import { fileURLToPath } from "url";

function loadPrismaClient() {
  // Next.js (webpack) 環境では通常通り動作する
  // vitest / tsx 環境では direct require で回避
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@prisma/client");
    return mod;
  } catch {
    // #imports マップが解決できない場合、直接 index.js を参照
    const clientPath = path.resolve(
      process.cwd(),
      "node_modules",
      ".prisma",
      "client",
      "index.js"
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(clientPath);
  }
}

const { PrismaClient } = loadPrismaClient();

export type PrismaClientType = InstanceType<typeof PrismaClient>;

export { PrismaClient };
