import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// This configuration generates types only. Hosting still uses vite.config.ts.
const directory = path.resolve("work/typecheck");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "wrangler.json"), JSON.stringify({
  name: "gym-tracker-typecheck", main: "../../worker/index.ts",
  compatibility_date: "2026-10-01", compatibility_flags: ["nodejs_compat"],
  d1_databases: [{ binding: "DB", database_name: "types-only", database_id: "00000000-0000-4000-8000-000000000000" }],
}));
const env = { ...process.env, WRANGLER_LOG_PATH: path.join(directory, "wrangler.log"), TMPDIR: directory };
for (const [script, args] of [
  ["node_modules/wrangler/bin/wrangler.js", ["types", "work/worker-configuration.d.ts", "--config", path.join(directory, "wrangler.json")]],
  ["node_modules/typescript/bin/tsc", ["--noEmit", "--incremental", "false"]],
]) {
  const result = spawnSync(process.execPath, [script, ...args], { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
