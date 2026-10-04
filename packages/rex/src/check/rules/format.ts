import { existsSync } from "node:fs";
import path from "node:path";
import { rexPrettierConfig } from "../../prettier.ts";
import { defineRule, finding, type Finding, type Location } from "../rule.ts";

type Prettier = typeof import("prettier");

export const FORMAT_RULE_ID = "format";
export const FORMAT_CODE = "format/prettier";
export const FORMAT_UNAVAILABLE_CODE = "format/unavailable";
export const FORMAT_IGNORE_FILES = [".prettierignore", ".gitignore"] as const;

const FORMAT_HINT =
  "Run the format script (prettier --write .) to apply the project's .prettierrc, or the rex/prettier preset when the app has none.";

function isMissingModule(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

async function loadPrettier(): Promise<Prettier | null> {
  try {
    return await import("prettier");
  } catch (error) {
    if (isMissingModule(error)) return null;
    throw error;
  }
}

export function firstDifference(source: string, formatted: string): Location {
  const before = source.split("\n");
  const after = formatted.split("\n");
  const count = Math.max(before.length, after.length);
  for (let index = 0; index < count; index += 1) {
    const left = before[index];
    const right = after[index];
    if (left === right) continue;
    if (left === undefined) return { line: before.length, column: 1 };
    let column = 0;
    while (column < left.length && left[column] === right?.[column]) column += 1;
    return { line: index + 1, column: column + 1 };
  }
  return { line: 1, column: 1 };
}

export const formatRule = defineRule({
  id: FORMAT_RULE_ID,
  description:
    "Runs prettier in check mode on every app source file with the app's prettier config, or the rex/prettier preset when it has none, and reports files the formatter would change.",
  async check({ app, sources }) {
    const prettier = await loadPrettier();
    if (prettier === null) {
      return [
        finding({
          rule: FORMAT_UNAVAILABLE_CODE,
          severity: "warning",
          file: "package.json",
          message: "prettier is not installed, so rex check cannot verify formatting",
          hint: "Add prettier to devDependencies (rex new does) and keep a .prettierrc naming @sidioralabs/rex/prettier.",
        }),
      ];
    }
    const ignorePath = FORMAT_IGNORE_FILES.map((name) => path.join(app.root, name)).filter(
      (candidate) => existsSync(candidate),
    );
    const files = [
      ...app.files.map((file) => file.path),
      ...app.unclassified.map((file) => path.resolve(app.root, file)),
    ].sort();
    const findings: Finding[] = [];
    for (const file of files) {
      const info = await prettier.getFileInfo(file, { ignorePath });
      if (info.ignored || info.inferredParser === null) continue;
      const options = (await prettier.resolveConfig(file)) ?? rexPrettierConfig;
      const source = sources.read(file);
      const formatted = await prettier.format(source, { ...options, filepath: file });
      if (formatted === source) continue;
      const at = firstDifference(source, formatted);
      const relative = app.relative(file);
      findings.push(
        finding({
          rule: FORMAT_CODE,
          severity: "warning",
          file: relative,
          line: at.line,
          column: at.column,
          message: `${relative} is not formatted: prettier --check would rewrite it from line ${at.line}`,
          hint: FORMAT_HINT,
        }),
      );
    }
    return findings;
  },
});
