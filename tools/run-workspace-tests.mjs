#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "test";
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const SHELL = process.platform === "win32";

function posix(path) {
  return path.split("\\").join("/");
}

function listWorkspace(root) {
  const result = spawnSync("pnpm", ["ls", "-r", "--depth", "-1", "--json"], {
    cwd: root,
    encoding: "utf8",
    shell: SHELL,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ls exited with ${result.status}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function order(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const ordered = [];
  const state = new Map();
  const visit = (pkg) => {
    if (state.has(pkg.name)) return;
    state.set(pkg.name, "visiting");
    for (const name of pkg.dependsOn) {
      const dependency = byName.get(name);
      if (dependency) visit(dependency);
    }
    state.set(pkg.name, "done");
    ordered.push(pkg);
  };
  for (const pkg of [...packages].sort((a, b) => a.dir.localeCompare(b.dir))) visit(pkg);
  return ordered;
}

export function workspacePackages(root = ROOT) {
  const top = resolve(root);
  const packages = listWorkspace(top)
    .filter((entry) => resolve(entry.path) !== top)
    .map((entry) => {
      const manifest = JSON.parse(readFileSync(join(entry.path, "package.json"), "utf8"));
      const dependsOn = DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));
      return {
        name: manifest.name ?? entry.name,
        dir: posix(relative(top, entry.path)),
        path: entry.path,
        scripts: manifest.scripts ?? {},
        dependsOn,
      };
    });
  return order(packages);
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function runWorkspaceTests(root = ROOT, io = {}) {
  const { stdio = "inherit", stdout = process.stdout } = io;
  const results = [];
  for (const pkg of workspacePackages(root)) {
    if (typeof pkg.scripts[SCRIPT] !== "string") {
      results.push({ name: pkg.name, dir: pkg.dir, outcome: "missing", detail: "no test script" });
      continue;
    }
    stdout.write(`\nrun-workspace-tests: ${pkg.name} (${pkg.dir})\n`);
    const started = Date.now();
    const run = spawnSync("pnpm", ["run", SCRIPT], { cwd: pkg.path, stdio, shell: SHELL });
    const duration = seconds(Date.now() - started);
    if (run.error) {
      results.push({ name: pkg.name, dir: pkg.dir, outcome: "fail", detail: run.error.message });
    } else if (run.status !== 0) {
      const reason = run.signal ? `signal ${run.signal}` : `exit ${run.status}`;
      results.push({
        name: pkg.name,
        dir: pkg.dir,
        outcome: "fail",
        detail: `${reason}, ${duration}`,
      });
    } else {
      results.push({ name: pkg.name, dir: pkg.dir, outcome: "pass", detail: duration });
    }
  }
  return { results, ok: results.every((result) => result.outcome === "pass") };
}

export function renderSummary(results) {
  const label = { pass: "pass", fail: "FAIL", missing: "FAIL" };
  const width = Math.max(...results.map((result) => result.name.length));
  const lines = ["", "run-workspace-tests summary"];
  for (const result of results) {
    lines.push(
      `  ${label[result.outcome]}  ${result.name.padEnd(width)}  ${result.dir}  ${result.detail}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function main(argv = process.argv.slice(2), io = {}) {
  const { root = ROOT, stdout = process.stdout, stderr = process.stderr, stdio } = io;
  if (argv.length > 0) {
    stderr.write(
      `run-workspace-tests: unknown option ${argv.join(", ")}\nusage: node tools/run-workspace-tests.mjs\n`,
    );
    return 2;
  }
  const { results, ok } = runWorkspaceTests(root, { stdio, stdout });
  if (results.length === 0) {
    stderr.write("run-workspace-tests: no workspace packages found\n");
    return 1;
  }
  stdout.write(renderSummary(results));
  if (ok) return 0;
  const failed = results.filter((result) => result.outcome !== "pass");
  stderr.write(
    `run-workspace-tests: ${failed.length} of ${results.length} packages failed: ${failed.map((result) => result.name).join(", ")}\n`,
  );
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
