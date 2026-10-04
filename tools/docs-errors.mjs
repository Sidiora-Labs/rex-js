#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_SOURCE = join(ROOT, "packages", "rex", "src", "core", "errors.ts");
const DOCS_SOURCE = join(ROOT, "packages", "rex", "src", "core", "errors.docs.ts");
export const ERRORS_DOC = join(ROOT, "docs", "errors.md");

export function renderErrorsDoc({ catalog, areas, hints, docs }) {
  const lines = [
    "# Rex error codes",
    "",
    `Generated from \`${shownPath(CATALOG_SOURCE)}\` and \`${shownPath(DOCS_SOURCE)}\` by \`pnpm docs:errors\` (\`node tools/docs-errors.mjs\`). Do not edit it by hand: \`node tools/docs-errors.mjs --check\` fails when this file is stale.`,
    "",
    "Every error Rex raises is a `RexError` carrying a code, a message naming the file and symbol, a hint, a docs link and, when known, the file, line and column of the source that caused it. The Vite overlay and the CLI show a source frame for errors with a location.",
    "",
  ];
  for (const info of Object.values(areas)) {
    const codes = Object.keys(catalog)
      .filter((code) => code.startsWith(info.prefix))
      .sort();
    if (codes.length === 0) continue;
    lines.push(`## ${info.prefix}xx ${info.title}`, "");
    lines.push("| Code | Error | Hint |", "| --- | --- | --- |");
    for (const code of codes) {
      const cell = (text) => text.replace(/\|/g, "\\|");
      lines.push(`| [${code}](${docs(code)}) | ${cell(catalog[code])} | ${cell(hints[code].hint)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function shownPath(file) {
  return relative(ROOT, file).split("\\").join("/");
}

export async function loadCatalog() {
  const runtime = await import(pathToFileURL(CATALOG_SOURCE).href);
  const documented = await import(pathToFileURL(DOCS_SOURCE).href);
  return {
    catalog: runtime.REX_ERROR_CATALOG,
    areas: documented.REX_ERROR_AREAS,
    hints: documented.REX_ERROR_DOCS,
    docs: runtime.errorDocs,
  };
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

export async function main(argv = process.argv.slice(2)) {
  const target = resolve(optionValue(argv, "--out") ?? ERRORS_DOC);
  const expected = renderErrorsDoc(await loadCatalog());
  const shown = relative(process.cwd(), target) || target;
  if (argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current === expected) {
      process.stdout.write(`${shown} is up to date\n`);
      return 0;
    }
    process.stderr.write(
      `${shown} is ${current === null ? "missing" : "stale"}; run pnpm docs:errors to regenerate it from the error catalog\n`,
    );
    return 1;
  }
  writeFileSync(target, expected);
  process.stdout.write(`wrote ${shown}\n`);
  return 0;
}

function isMain() {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = await main();
}
