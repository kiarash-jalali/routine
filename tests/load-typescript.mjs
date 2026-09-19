import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

export function loadTypeScriptModule(fileUrl, mocks = {}) {
  const filename = fileUrl.pathname;
  const source = fs.readFileSync(fileUrl, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      strict: true,
    },
  }).outputText;

  const module = { exports: {} };
  const localRequire = (id) =>
    Object.prototype.hasOwnProperty.call(mocks, id)
      ? mocks[id]
      : nativeRequire(id);

  const execute = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    output,
  );
  execute(
    module.exports,
    localRequire,
    module,
    filename,
    path.dirname(filename),
  );
  return module.exports;
}
