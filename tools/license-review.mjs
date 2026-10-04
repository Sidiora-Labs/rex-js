#!/usr/bin/env node
// License review ([decision] license_scope): the full production closure of every
// published workspace package and of the private apps (the demo) must carry an
// allowed license. Every package is walked through its dependencies,
// optionalDependencies and required peerDependencies. An optional peer joins the
// closure when pnpm resolved it for that package (linked beside it in the store),
// and for a workspace package once another production path installs a package of
// that name. devDependencies are not shipped and are not walked.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "MPL-2.0",
  "CC-BY-4.0",
  "Unlicense",
]);

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

const STORE_SEGMENT = `${sep}node_modules${sep}.pnpm${sep}`;

function isResolvedPeer(dir, name) {
  if (!dir.includes(STORE_SEGMENT)) return false;
  if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
  let parent = dirname(dir);
  while (basename(parent) !== "node_modules") parent = dirname(parent);
  return existsSync(join(parent, name, "package.json"));
}

function workspaceProjects() {
  const output = execFileSync("pnpm", ["ls", "-r", "--json", "--depth", "-1"], { cwd: ROOT, encoding: "utf8" });
  const root = realpathSync(ROOT);
  return JSON.parse(output)
    .map((project) => ({ dir: realpathSync(project.path), published: project.private !== true }))
    .filter((project) => project.dir !== root);
}

const reviewed = new Map();
const failures = [];
const closureNames = new Set();
const optionalPeers = [];

function checkLicense(dir, manifest, id, path) {
  const license = declaredLicense(manifest);
  reviewed.set(dir, { id, license: license ?? "(none)" });
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
}

function walk(dir, manifest, chain) {
  const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}));
  const peerMeta = manifest.peerDependenciesMeta ?? {};
  const peers = Object.keys(manifest.peerDependencies ?? {});
  for (const name of peers) {
    if (peerMeta[name]?.optional !== true || optional.has(name)) continue;
    if (isResolvedPeer(dir, name)) optional.add(name);
    else optionalPeers.push({ dir, name, chain });
  }
  const required = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...peers.filter((name) => peerMeta[name]?.optional !== true),
  ].filter((name) => !optional.has(name));
  for (const name of new Set(required)) {
    const installed = resolveInstalled(dir, name);
    if (installed === undefined) {
      failures.push({ id: name, reason: "dependency is not installed", path: [...chain, name] });
      continue;
    }
    review(installed, chain);
  }
  for (const name of optional) {
    const installed = resolveInstalled(dir, name);
    if (installed !== undefined) review(installed, chain);
  }
}

function review(dir, chain) {
  if (reviewed.has(dir)) return;
  const manifest = readManifest(dir);
  const id = `${manifest.name}@${manifest.version}`;
  const path = [...chain, id];
  closureNames.add(manifest.name);
  checkLicense(dir, manifest, id, path);
  walk(dir, manifest, path);
}

const projects = workspaceProjects();
const roots = projects.map((project) => project.dir);
if (!projects.some((project) => project.published)) {
  console.error("license-review: no published workspace package found");
  process.exit(1);
}
for (const project of projects) {
  if (project.published) {
    review(project.dir, []);
  } else {
    const manifest = readManifest(project.dir);
    walk(project.dir, manifest, [manifest.name ?? relative(ROOT, project.dir)]);
  }
}
for (let grown = true; grown; ) {
  const before = reviewed.size;
  for (let index = 0; index < optionalPeers.length; index++) {
    const { dir, name, chain } = optionalPeers[index];
    if (!closureNames.has(name)) continue;
    const installed = resolveInstalled(dir, name);
    if (installed !== undefined) review(installed, chain);
  }
  grown = reviewed.size !== before;
}

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
