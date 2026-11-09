#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "packages/rex/package.json");
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

const USAGE = `usage: node tools/verify-published.mjs --version <x.y.z> [--package <name>] [--registry <url>] [--attempts <n>] [--delay <seconds>] [--keep]

Installs <name>@<version> from the registry into a fresh directory with every peer it declares,
imports every entry of its exports map, runs its bin with --version and fails on any miss. The
install is retried while the registry has not yet propagated the version.
`;

export function parseArguments(argv) {
  const options = { attempts: 10, delay: 30, keep: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${flag} needs a value`);
      index += 1;
      return next;
    };
    if (flag === "--version") options.version = value();
    else if (flag === "--package") options.name = value();
    else if (flag === "--registry") options.registry = value();
    else if (flag === "--attempts") options.attempts = Number(value());
    else if (flag === "--delay") options.delay = Number(value());
    else if (flag === "--keep") options.keep = true;
    else throw new Error(`unknown argument ${flag}`);
  }
  if (options.version === undefined || !EXACT.test(options.version)) {
    throw new Error("--version must name an exact published version");
  }
  if (!Number.isInteger(options.attempts) || options.attempts < 1) {
    throw new Error("--attempts must be a positive integer");
  }
  if (!Number.isFinite(options.delay) || options.delay < 0) {
    throw new Error("--delay must be a number of seconds");
  }
  return options;
}

export function exportTarget(value) {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return null;
  for (const condition of ["import", "default"]) {
    if (value[condition] !== undefined) return exportTarget(value[condition]);
  }
  return null;
}

export function entries(name, manifest) {
  const exports = manifest.exports;
  if (exports === undefined || exports === null || typeof exports !== "object") {
    throw new Error(`${name} declares no exports map`);
  }
  return Object.entries(exports).map(([key, value]) => {
    const target = exportTarget(value);
    if (target === null) throw new Error(`${name} export ${key} has no import or default target`);
    return {
      key,
      specifier: key === "." ? name : `${name}${key.slice(1)}`,
      json: target.endsWith(".json"),
    };
  });
}

function npm(args, cwd, registry) {
  const full = registry === undefined ? args : [...args, "--registry", registry];
  return spawnSync(NPM, full, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function sleep(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function install(specs, cwd, registry) {
  return npm(["install", "--no-audit", "--no-fund", "--save-exact", ...specs], cwd, registry);
}

const IMPORT_EVERY_ENTRY = `
const results = [];
for (const entry of JSON.parse(process.argv[1])) {
  try {
    const loaded = entry.json
      ? await import(entry.specifier, { with: { type: "json" } })
      : await import(entry.specifier);
    results.push({ key: entry.key, ok: true, exports: Object.keys(loaded).length });
  } catch (error) {
    results.push({ key: entry.key, ok: false, error: String(error?.stack ?? error).split("\\n").slice(0, 3).join(" | ") });
  }
}
process.stdout.write(JSON.stringify(results));
`;

export function verifyPublished(options, io = {}) {
  const { stdout = process.stdout, stderr = process.stderr } = io;
  const name = options.name ?? JSON.parse(readFileSync(MANIFEST, "utf8")).name;
  const spec = `${name}@${options.version}`;
  const work = mkdtempSync(join(tmpdir(), "rex-verify-published-"));
  const problems = [];
  try {
    writeFileSync(
      join(work, "package.json"),
      JSON.stringify({ name: "rex-verify-published", private: true, type: "module" }, null, 2),
    );
    let installed = null;
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const result = install([spec], work, options.registry);
      if (result.status === 0) {
        installed = result;
        break;
      }
      stderr.write(
        `verify-published: npm install ${spec} failed (attempt ${attempt} of ${options.attempts})\n${result.stderr}`,
      );
      if (attempt < options.attempts) sleep(options.delay);
    }
    if (installed === null) {
      problems.push(`${spec} could not be installed from the registry`);
      return problems;
    }
    const packageDir = join(work, "node_modules", ...name.split("/"));
    const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
    if (manifest.version !== options.version) {
      problems.push(`installed ${name} is ${manifest.version}, expected ${options.version}`);
    }
    const peers = Object.entries(manifest.peerDependencies ?? {}).map(
      ([peer, range]) => `${peer}@${range}`,
    );
    if (peers.length > 0) {
      const result = install([spec, ...peers], work, options.registry);
      if (result.status !== 0) {
        problems.push(`the peers of ${spec} could not be installed:\n${result.stderr}`);
        return problems;
      }
    }
    const published = entries(name, manifest);
    if (options.name === undefined) {
      const local = Object.keys(JSON.parse(readFileSync(MANIFEST, "utf8")).exports ?? {});
      const keys = published.map((entry) => entry.key);
      for (const key of local.filter((key) => !keys.includes(key))) {
        problems.push(`the published exports map lacks ${key}, which packages/rex declares`);
      }
      for (const key of keys.filter((key) => !local.includes(key))) {
        problems.push(`the published exports map has ${key}, which packages/rex does not declare`);
      }
    }
    const run = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", IMPORT_EVERY_ENTRY, JSON.stringify(published)],
      { cwd: work, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (run.status !== 0) {
      problems.push(`importing the entries exited with ${run.status}:\n${run.stderr}`);
      return problems;
    }
    for (const result of JSON.parse(run.stdout)) {
      const specifier = result.key === "." ? name : `${name}${result.key.slice(1)}`;
      if (result.ok) stdout.write(`ok    ${specifier} (${result.exports} exports)\n`);
      else problems.push(`${specifier} failed to import: ${result.error}`);
    }
    for (const [bin, target] of Object.entries(
      typeof manifest.bin === "string" ? { [name]: manifest.bin } : (manifest.bin ?? {}),
    )) {
      const version = spawnSync(process.execPath, [join(packageDir, target), "--version"], {
        cwd: work,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const printed = version.stdout.trim();
      if (version.status !== 0 || printed !== options.version) {
        problems.push(
          `${bin} --version exited ${version.status} and printed ${JSON.stringify(printed)}, expected ${options.version}\n${version.stderr}`,
        );
      } else {
        stdout.write(`ok    ${bin} --version prints ${printed}\n`);
      }
    }
    return problems;
  } finally {
    if (options.keep) stdout.write(`verify-published: kept ${work}\n`);
    else rmSync(work, { recursive: true, force: true });
  }
}

export function main(argv = process.argv.slice(2), io = {}) {
  const { stdout = process.stdout, stderr = process.stderr } = io;
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    stderr.write(`verify-published: ${error.message}\n${USAGE}`);
    return 2;
  }
  const problems = verifyPublished(options, { stdout, stderr });
  if (problems.length > 0) {
    for (const problem of problems) stderr.write(`FAIL  ${problem}\n`);
    stderr.write(`verify-published: ${problems.length} problem(s) with the published version\n`);
    return 1;
  }
  stdout.write(
    `verify-published: ${options.version} installs from the registry and every entry imports\n`,
  );
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
