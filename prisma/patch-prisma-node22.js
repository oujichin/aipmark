// Prisma v6 + Node 22: #main-entry-point imports map が CJS で解決できない問題のパッチ
// prisma generate 後に実行する
const fs = require("fs");
const path = require("path");

const target = path.resolve(__dirname, "..", "node_modules", ".prisma", "client", "default.js");

if (fs.existsSync(target)) {
  fs.writeFileSync(
    target,
    '/* Patched for Node 22 CJS compatibility */\nmodule.exports = { ...require("./index.js") }\n'
  );
  console.log("Patched .prisma/client/default.js for Node 22");
}
