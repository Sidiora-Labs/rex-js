#!/usr/bin/env node
// License review: every package a published workspace package installs through
// its dependencies and optionalDependencies must carry an allowed license.
// Peers are chosen and installed by the adopter, so they are not walked.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "CC0-1.0"]);

function readManifest(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

function declaredLicense(manifest) {
  if (typeof manifest.license === "string") return manifest.license;
  if (manifest.license && typeof manifest.license.type === "string") return manifest.license.type;
  if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
    const types = manifest.licenses.map((entry) => (typeof entry === "string" ? entry : entry?.type));
    if (types.every((type) => typeof type === "string")) return `(${types.join(" OR ")})`;
  }
  return undefined;
}

function tokenize(expression) {
  return expression
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function isAllowed(expression) {
  const tokens = tokenize(expression);
  let index = 0;
  const peek = () => tokens[index];
  const next = () => tokens[index++];
  function primary() {
    const token = next();
    if (token === undefined) throw new Error(`incomplete license expression "${expression}"`);
    if (token === "(") {
      const value = disjunction();
      if (next() !== ")") throw new Error(`unbalanced license expression "${expression}"`);
      return value;
    }
    if (token === ")" || token === "AND" || token === "OR" || token === "WITH") {
      throw new Error(`malformed license expression "${expression}"`);
    }
    if (peek() === "WITH") {
      next();
      if (next() === undefined) throw new Error(`incomplete license expression "${expression}"`);
    }
    return ALLOWED.has(token);
  }
  function conjunction() {
    let value = primary();
    while (peek() === "AND") {
      next();
      value = primary() && value;
    }
    return value;
  }
  function disjunction() {
    let value = conjunction();
    while (peek() === "OR") {
      next();
      value = conjunction() || value;
    }
    return value;
  }
  const value = disjunction();
  if (index !== tokens.length) throw new Error(`malformed license expression "${expression}"`);
  return value;
}

function resolveInstalled(fromDir, name) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function publishedWorkspacePackages() {
  const output = execFileSync("pnpm", ["ls", "-r", "--json", "--depth", "-1"], { cwd: ROOT, encoding: "utf8" });
  return JSON.parse(output)
    .filter((project) => project.private !== true)
    .map((project) => realpathSync(project.path));
}

const reviewed = new Map();
const failures = [];

function review(dir, chain) {
  if (reviewed.has(dir)) return;
  const manifest = readManifest(dir);
  const id = `${manifest.name}@${manifest.version}`;
  const license = declaredLicense(manifest);
  reviewed.set(dir, { id, license: license ?? "(none)" });
  const path = [...chain, id];
  let allowed = false;
  let reason = license === undefined ? "no license declared" : `license ${license} is not allowed`;
  if (license !== undefined) {
    try {
      allowed = isAllowed(license);
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (!allowed) failures.push({ id, reason, path });
  const required = Object.keys(manifest.dependencies ?? {});
  const optional = Object.keys(manifest.optionalDependencies ?? {});
  for (const name of required) {
    if (optional.includes(name)) continue;
    const installed = resolveInstalled(dir, name);
    if (installed === undefined) {
      failures.push({ id: name, reason: "dependency is not installed", path: [...path, name] });
      continue;
    }
    review(installed, path);
  }
  for (const name of optional) {
    const installed = resolveInstalled(dir, name);
    if (installed !== undefined) review(installed, path);
  }
}

const roots = publishedWorkspacePackages();
if (roots.length === 0) {
  console.error("license-review: no published workspace package found");
  process.exit(1);
}
for (const root of roots) review(root, []);

const counts = new Map();
for (const { license } of reviewed.values()) counts.set(license, (counts.get(license) ?? 0) + 1);
const summary = [...counts.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([license, count]) => `${license} ${count}`)
  .join(", ");
console.log(
  `license-review: ${reviewed.size} packages from ${roots.map((root) => relative(ROOT, root) || ".").join(", ")}: ${summary}`,
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`license-review: ${failure.id}: ${failure.reason} (via ${failure.path.join(" > ")})`);
  }
  console.error(`license-review: ${failures.length} package(s) outside ${[...ALLOWED].join(", ")}`);
  process.exit(1);
}
console.log(`license-review: every license is one of ${[...ALLOWED].join(", ")}`);
