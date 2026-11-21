// Claude Code PostToolUse hook: lint the file Claude just edited.
// Exit code 2 sends ESLint's output back to Claude so it fixes the problem
// right away instead of finding out at `npm run verify`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LINTABLE = /\.(ts|tsx|js|jsx|mjs)$/;

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let filePath = "";
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const eslintBin = path.join(projectDir, "node_modules", "eslint", "bin", "eslint.js");

if (
  !filePath ||
  !LINTABLE.test(filePath) ||
  filePath.includes("node_modules") ||
  !existsSync(filePath) ||
  !existsSync(eslintBin)
) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [eslintBin, "--no-warn-ignored", filePath],
  { cwd: projectDir, encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(
    `ESLint failed for ${path.relative(projectDir, filePath)}:\n${result.stdout}${result.stderr}`,
  );
  process.exit(2);
}
