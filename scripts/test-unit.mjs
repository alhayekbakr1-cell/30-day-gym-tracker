import ts from "typescript";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const program = ts.createProgram([
  "app/tracker-logic.ts", "app/countdown-logic.ts", "app/session-logic.ts",
  "app/backup-logic.ts", "lib/tracker-sync.ts", "lib/tracker-validation.ts",
  "app/training-insights.ts", "app/exercise-history.ts", "lib/tab-recovery.ts", "lib/gemini-coach.ts",
], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10, outDir: ".test-build", rootDir: ".",
  strict: true, skipLibCheck: true, esModuleInterop: true, noEmitOnError: true,
});
const emitted = program.emit();
const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitted.diagnostics);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n",
  }));
  process.exit(1);
}
mkdirSync(".test-build", { recursive: true });
writeFileSync(".test-build/package.json", '{"type":"commonjs"}\n');
const result = spawnSync(process.execPath, ["--test", "tests/tracker.test.mjs", "tests/sync.test.mjs", "tests/four-day.test.mjs", "tests/history.test.mjs", "tests/offline.test.mjs", "tests/tabs.test.mjs", "tests/coach.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
