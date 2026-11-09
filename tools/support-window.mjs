#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MATRIX = Object.freeze([
  { tool: "typescript", version: "5.9.3" },
  { tool: "typescript", version: "6.0.3" },
  { tool: "typescript", version: "7.0.2" },
  { tool: "eslint", version: "9.39.5" },
  { tool: "eslint", version: "10.14.0" },
]);

export const TOOLS = Object.freeze(["typescript", "eslint"]);

export const DOC = "docs/versioning.md";
export const PACKAGE = "packages/rex/package.json";

const ROOT_FILES = ["package.json", "pnpm-lock.yaml", ".npmrc", "tsconfig.base.json"];
const PROJECTS = ["packages/rex", "site"];
const SKIPPED = new Set(["node_modules", "dist", "coverage"]);
const LINE = /^support-window (\S+) (\d+\.\d+\.\d+) (pass|fail)(?:: (.+))?$/;
const ROW =
  /^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*(\d+\.\d+\.\d+)\s*\|\s*(pass|fail)\s*\|\s*(.*?)\s*\|$/;

export const COMMANDS = Object.freeze([
  ["pnpm", "install", "--no-frozen-lockfile"],
  ["pnpm", "-C", "packages/rex", "typecheck"],
  ["pnpm", "-C", "packages/rex", "exec", "vitest", "run", "src/check", "src/eslint"],
]);

export function majorOf(version) {
  const match = /^\^?(\d+)\./.exec(version);
  if (!match) throw new Error(`not a version: ${version}`);
  return Number(match[1]);
}

export function formatResultLine(result) {
  const head = `support-window ${result.tool} ${result.version} ${result.result}`;
  return result.result === "fail" ? `${head}: ${result.command}` : head;
}

export function parseResultLine(line) {
  const match = LINE.exec(line.trim());
  if (!match) return null;
  const [, tool, version, result, command] = match;
  if (result === "fail" && !command) return null;
  if (result === "pass" && command) return null;
  return { tool, major: majorOf(version), version, result, command: command ?? "" };
}

export function parseResultLines(text) {
  return text
    .split("\n")
    .map(parseResultLine)
    .filter((result) => result !== null);
}

export function parseResultsTable(markdown) {
  const results = [];
  for (const line of markdown.split("\n")) {
    const match = ROW.exec(line.trim());
    if (!match) continue;
    const [, tool, major, version, result, cell] = match;
    const command = cell.replace(/^`|`$/g, "");
    if (Number(major) !== majorOf(version)) {
      throw new Error(`${tool} ${version} is listed under major ${major}`);
    }
    if (result === "fail" && command === "") {
      throw new Error(`${tool} ${version} fails without a recorded command`);
    }
    results.push({ tool, major: Number(major), version, result, command });
  }
  return results;
}

export function renderResultsTable(results) {
  const rows = results.map((entry) => [
    `\`${entry.tool}\``,
    String(entry.major),
    entry.version,
    entry.result,
    entry.command ? `\`${entry.command}\`` : "",
  ]);
  const header = ["Package", "Major", "Tested version", "Result", "Failing command"];
  const widths = header.map((cell, index) =>
    Math.max(cell.length, 3, ...rows.map((row) => row[index].length)),
  );
  const line = (cells) =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  return [
    line(header),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...rows.map(line),
  ].join("\n");
}

export function computeRange(results, tool) {
  const passing = results
    .filter((entry) => entry.tool === tool && entry.result === "pass")
    .sort((a, b) => a.major - b.major);
  const majors = new Set();
  const parts = [];
  for (const entry of passing) {
    if (majors.has(entry.major)) {
      throw new Error(`${tool} major ${entry.major} has more than one passing result`);
    }
    majors.add(entry.major);
    parts.push(`^${entry.version}`);
  }
  if (parts.length === 0) throw new Error(`${tool} has no passing major`);
  return parts.join(" || ");
}

export function rangeMajors(range) {
  return range.split("||").map((part) => majorOf(part.trim()));
}

export function checkWindow({ results, rexManifest, rootManifest, matrix = MATRIX }) {
  const problems = [];
  for (const entry of matrix) {
    const recorded = results.filter(
      (result) => result.tool === entry.tool && result.version === entry.version,
    );
    if (recorded.length !== 1) {
      problems.push(`${DOC} records ${recorded.length} results for ${entry.tool} ${entry.version}`);
    }
  }
  for (const result of results) {
    if (!matrix.some((entry) => entry.tool === result.tool && entry.version === result.version)) {
      problems.push(
        `${DOC} records ${result.tool} ${result.version}, which the matrix does not list`,
      );
    }
  }
  for (const tool of TOOLS) {
    let expected;
    try {
      expected = computeRange(results, tool);
    } catch (error) {
      problems.push(error.message);
      continue;
    }
    const peer = rexManifest.peerDependencies?.[tool];
    if (peer !== expected) {
      problems.push(
        `${PACKAGE} peerDependencies.${tool} is ${JSON.stringify(peer)}; the tested window is "${expected}"`,
      );
    }
    const supported = rangeMajors(expected);
    for (const [label, manifest] of [
      [PACKAGE, rexManifest],
      ["package.json", rootManifest],
    ]) {
      const dev = manifest.devDependencies?.[tool];
      if (dev !== undefined && !supported.includes(majorOf(dev))) {
        problems.push(
          `${label} devDependencies.${tool} ${dev} is outside the tested window "${expected}"`,
        );
      }
    }
  }
  return problems;
}

function workspaceYaml(text) {
  const projects = PROJECTS.map((project) => `  - ${project}\n`).join("");
  return `packages:\n${projects}${text.replace(/^packages:\n(?:[ \t]+-[^\n]*\n)*/m, "")}`;
}

export function prepareCopy(root, entry) {
  const dir = mkdtempSync(join(tmpdir(), `rex-support-${entry.tool}-${entry.version}-`));
  for (const file of ROOT_FILES) cpSync(join(root, file), join(dir, file));
  writeFileSync(
    join(dir, "pnpm-workspace.yaml"),
    workspaceYaml(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")),
  );
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  manifest.pnpm = {
    ...manifest.pnpm,
    overrides: { ...manifest.pnpm?.overrides, [entry.tool]: entry.version },
  };
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const project of PROJECTS) {
    cpSync(join(root, project), join(dir, project), {
      recursive: true,
      filter: (source) => !SKIPPED.has(basename(source)),
    });
  }
  return dir;
}

export function runEntry(root, entry, log = () => {}) {
  const dir = prepareCopy(root, entry);
  try {
    for (const [index, argv] of COMMANDS.entries()) {
      const command = argv.join(" ");
      log(`$ ${command}`);
      const run = spawnSync(argv[0], argv.slice(1), {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, CI: "1" },
        maxBuffer: 256 * 1024 * 1024,
      });
      log(`${run.stdout ?? ""}${run.stderr ?? ""}`);
      if (run.status !== 0) {
        return {
          ...entry,
          major: majorOf(entry.version),
          result: "fail",
          command: `${command} (exit ${run.status ?? run.signal})`,
        };
      }
      if (index === 0) {
        const installed = JSON.parse(
          readFileSync(
            join(dir, "packages", "rex", "node_modules", entry.tool, "package.json"),
            "utf8",
          ),
        ).version;
        if (installed !== entry.version) {
          return {
            ...entry,
            major: majorOf(entry.version),
            result: "fail",
            command: `${command} (installed ${installed})`,
          };
        }
      }
    }
    return { ...entry, major: majorOf(entry.version), result: "pass", command: "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function recordResults(markdown, results) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => ROW.test(line.trim()));
  if (start < 2) throw new Error(`${DOC} has no support window table`);
  let end = start;
  while (end < lines.length && ROW.test(lines[end].trim())) end += 1;
  return [...lines.slice(0, start - 2), renderResultsTable(results), ...lines.slice(end)].join(
    "\n",
  );
}

function main(argv) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (file) => readFileSync(join(root, file), "utf8");
  if (argv.includes("--check")) {
    let results;
    try {
      results = parseResultsTable(read(DOC));
    } catch (error) {
      console.error(`support-window: ${error.message}`);
      return 1;
    }
    const problems = checkWindow({
      results,
      rexManifest: JSON.parse(read(PACKAGE)),
      rootManifest: JSON.parse(read("package.json")),
    });
    for (const result of results) console.log(formatResultLine(result));
    for (const problem of problems) console.error(`support-window: ${problem}`);
    if (problems.length > 0) return 1;
    for (const tool of TOOLS)
      console.log(`support-window ${tool} window ${computeRange(results, tool)}`);
    return 0;
  }
  const only = argv.filter((arg) => !arg.startsWith("--"));
  const matrix =
    only.length === 0
      ? MATRIX
      : MATRIX.filter((entry) => only.includes(`${entry.tool}@${entry.version}`));
  const verbose = argv.includes("--verbose");
  const results = [];
  for (const entry of matrix) {
    const result = runEntry(
      root,
      entry,
      verbose ? (text) => process.stderr.write(`${text}\n`) : undefined,
    );
    results.push(result);
    console.log(formatResultLine(result));
  }
  if (argv.includes("--record")) {
    if (matrix.length !== MATRIX.length) {
      console.error("support-window: --record needs a run over the whole matrix");
      return 1;
    }
    writeFileSync(join(root, DOC), recordResults(read(DOC), results));
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
