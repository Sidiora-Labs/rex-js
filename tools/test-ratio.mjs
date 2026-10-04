#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const MINIMUM_RATIO = 1;
export const CODE_EXTENSIONS = [".ts", ".tsx"];
export const PACKAGES = [
  {
    name: "packages/rex",
    dir: "packages/rex",
    scan: ["src"],
    tests: ["src/testing"],
    testSuffixes: [".conformance.ts"],
    exclude: [],
    group: 2,
  },
  {
    name: "examples/demo",
    dir: "examples/demo",
    scan: ["app", "server.ts", "e2e"],
    tests: ["e2e", "app/pages/*/test"],
    testSuffixes: [],
    exclude: ["app/components/ui"],
    group: 3,
  },
];
const FLAGS = ["--check", "--json"];
const SKIPPED_DIRS = new Set(["node_modules", "dist"]);
const FIXTURES_DIR = "fixtures";
const TEST_FILE = /\.test\.tsx?$/;
const DECLARATION_FILE = /\.d\.ts$/;
const GENERATED_NAME = /\.generated\.[^/]+$/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|<!--)/;
const GENERATED_TAG = /@generated\b/;
const GENERATED_NOTICE = /\bgenerated\b.*\bdo not edit\b/i;
const SHEBANG = /^#!/;
const COLUMNS = ["directory", "source files", "source lines", "test files", "test lines", "ratio"];

function isCodeFile(name) {
  return CODE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function posix(path) {
  return path.split("\\").join("/");
}

function matchesPrefix(path, pattern) {
  const segments = path.split("/");
  const wanted = pattern.split("/");
  if (wanted.length > segments.length) return false;
  return wanted.every((segment, index) => segment === "*" || segment === segments[index]);
}

export function isGenerated(path, text) {
  if (GENERATED_NAME.test(path)) return true;
  for (const line of text.split(/\r?\n/, 4)) {
    if (line.trim() === "" || SHEBANG.test(line)) continue;
    return COMMENT_LINE.test(line) && (GENERATED_TAG.test(line) || GENERATED_NOTICE.test(line));
  }
  return false;
}

export function classify(pkg, path, text) {
  if (DECLARATION_FILE.test(path)) return "excluded";
  if (path.split("/").includes(FIXTURES_DIR)) return "excluded";
  if (isGenerated(path, text)) return "excluded";
  if (pkg.exclude.some((pattern) => matchesPrefix(path, pattern))) return "excluded";
  if (TEST_FILE.test(path)) return "test";
  if (pkg.testSuffixes.some((suffix) => path.endsWith(suffix))) return "test";
  if (pkg.tests.some((pattern) => matchesPrefix(path, pattern))) return "test";
  return "source";
}

export function countLines(text) {
  let count = 0;
  for (const line of text.split(/\r?\n/)) if (line.trim() !== "") count += 1;
  return count;
}

function collect(dir, base, files) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || SKIPPED_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) collect(path, base, files);
    else if (isCodeFile(name)) files.push(posix(relative(base, path)));
  }
}

function codeFiles(dir, scan) {
  const files = [];
  for (const entry of scan) {
    const path = join(dir, entry);
    if (!existsSync(path)) continue;
    if (statSync(path).isDirectory()) collect(path, dir, files);
    else if (isCodeFile(entry)) files.push(posix(entry));
  }
  return files;
}

function groupOf(path, depth) {
  const directories = path.split("/").slice(0, -1);
  return directories.length === 0 ? "." : directories.slice(0, depth).join("/");
}

function counts() {
  return { files: 0, lines: 0 };
}

function ratioOf(source, test) {
  return source.lines === 0 ? null : test.lines / source.lines;
}

export function measurePackage(pkg, root = ROOT) {
  const dir = join(root, pkg.dir);
  const rows = new Map();
  const source = counts();
  const test = counts();
  let excluded = 0;
  for (const file of codeFiles(dir, pkg.scan)) {
    const text = readFileSync(join(dir, file), "utf8");
    const kind = classify(pkg, file, text);
    if (kind === "excluded") {
      excluded += 1;
      continue;
    }
    const lines = countLines(text);
    const key = groupOf(file, pkg.group);
    const row = rows.get(key) ?? { directory: key, source: counts(), test: counts() };
    rows.set(key, row);
    for (const bucket of [row[kind], kind === "source" ? source : test]) {
      bucket.files += 1;
      bucket.lines += lines;
    }
  }
  const directories = [...rows.keys()].sort().map((key) => {
    const row = rows.get(key);
    return { ...row, ratio: ratioOf(row.source, row.test) };
  });
  const ratio = ratioOf(source, test);
  return {
    name: pkg.name,
    scan: pkg.scan,
    directories,
    source,
    test,
    excluded,
    ratio,
    ok: ratio === null || ratio >= MINIMUM_RATIO,
  };
}

export function measure(root = ROOT, packages = PACKAGES) {
  const reports = packages.map((pkg) => measurePackage(pkg, root));
  return { minimum: MINIMUM_RATIO, packages: reports, ok: reports.every((report) => report.ok) };
}

function formatRatio(ratio) {
  return ratio === null ? "-" : ratio.toFixed(2);
}

function cells(label, row) {
  return [
    label,
    String(row.source.files),
    String(row.source.lines),
    String(row.test.files),
    String(row.test.lines),
    formatRatio(row.ratio),
  ];
}

export function renderPackage(report) {
  const rows = [
    COLUMNS,
    ...report.directories.map((row) => cells(row.directory, row)),
    cells("total", report),
  ];
  const widths = COLUMNS.map((_, index) => Math.max(...rows.map((row) => row[index].length)));
  const lines = [`${report.name} (${report.scan.join(", ")})`];
  for (const row of rows) {
    const padded = row.map((cell, index) =>
      index === 0 ? cell.padEnd(widths[index]) : cell.padStart(widths[index]),
    );
    lines.push(`  ${padded.join("  ")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2), io = {}) {
  const { root = ROOT, packages = PACKAGES, stdout = process.stdout, stderr = process.stderr } = io;
  const unknown = argv.filter((argument) => !FLAGS.includes(argument));
  if (unknown.length > 0) {
    stderr.write(
      `test-ratio: unknown option ${unknown.join(", ")}\nusage: node tools/test-ratio.mjs [--check] [--json]\n`,
    );
    return 2;
  }
  const report = measure(root, packages);
  const json = argv.includes("--json");
  if (json) stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else stdout.write(report.packages.map(renderPackage).join("\n"));
  if (!argv.includes("--check")) return 0;
  const minimum = MINIMUM_RATIO.toFixed(2);
  const below = report.packages.filter((pkg) => !pkg.ok);
  if (below.length === 0) {
    if (!json) {
      stdout.write(
        `test-ratio: every package has at least ${minimum} lines of test code per line of source\n`,
      );
    }
    return 0;
  }
  for (const pkg of below) {
    stderr.write(
      `test-ratio: ${pkg.name} has ${formatRatio(pkg.ratio)} lines of test code per line of source, below ${minimum}\n`,
    );
  }
  return 1;
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
  process.exitCode = main();
}
