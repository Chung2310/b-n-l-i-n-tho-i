import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Keep the existing Node and Vitest suites separate; running node:test through
// Vitest reports empty suites and can hide the actual assertion failures.
function testsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? testsIn(path) : /\.test\.tsx?$/.test(path) ? [path] : [];
  });
}
const files = [
  ...testsIn("server/modules/inventory"),
  ...testsIn("src/components/inventory"),
  ...testsIn("src/services").filter((file) => /\/(inventory|productCatalog)/.test(file)),
  "server/integrations/shared/stock-movement.integration.test.ts",
  "server/model/inventory-models.test.ts",
  "server/service/crud-inventory-guard.test.ts",
  "server/service/crud-branch-scope.test.ts",
  "server/modules/retail/services/retail-after-sale.service.test.ts",
  "src/pages/inventoryBranchRefresh.test.tsx",
];
const nodeTests = [], vitestTests = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (/from\s+["']node:test["']/.test(source)) nodeTests.push(file);
  else if (/from\s+["']vitest["']/.test(source)) vitestTests.push(file);
  else throw new Error(`Unknown test runner: ${file}`);
}
let failed = false;
for (const args of [
  ["--import", "tsx", "--test", ...nodeTests],
  [resolve("node_modules/vitest/vitest.mjs"), "run", "--maxWorkers=2", ...vitestTests],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
