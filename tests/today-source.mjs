import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

/** Files that make up the Today screen (shell + sections). */
export function todayFiles() {
  return [
    "src/app/dashboard/DashboardClient.tsx",
    ...readdirSync(new URL("src/components/today/", root))
      .filter((name) => /\.tsx?$/.test(name))
      .sort()
      .map((name) => `src/components/today/${name}`),
  ];
}

/** Concatenated source of the Today screen, for source-string assertions. */
export function todaySource() {
  return todayFiles()
    .map((path) => readFileSync(new URL(path, root), "utf8"))
    .join("\n");
}
