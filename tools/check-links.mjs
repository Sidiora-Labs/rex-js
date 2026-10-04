#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_TARGETS = ["README.md", "docs"];

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function markdownFiles(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return extname(path) === ".md" ? [path] : [];
  const files = [];
  for (const name of readdirSync(path).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    files.push(...markdownFiles(join(path, name)));
  }
  return files;
}

function proseLines(source) {
  const lines = source.split(/\r?\n/);
  const result = [];
  let fence = null;
  for (const [index, line] of lines.entries()) {
    const open = FENCE.exec(line);
    if (fence === null && open) {
      fence = open[1];
      continue;
    }
    if (fence !== null) {
      const close = FENCE.exec(line);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length &&
        line.trim() === close[1]
      )
        fence = null;
      continue;
    }
    result.push({ number: index + 1, text: line.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, "") });
  }
  return result;
}

export function slugify(heading) {
  const text = heading
    .replace(/<[^>]+>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\\(.)/g, "$1");
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

const anchorCache = new Map();

export function anchorsOf(file) {
  const cached = anchorCache.get(file);
  if (cached !== undefined) return cached;
  const source = readFileSync(file, "utf8");
  const anchors = new Set();
  const counts = new Map();
  let fence = null;
  for (const line of source.split(/\r?\n/)) {
    const open = FENCE.exec(line);
    if (fence === null && open) {
      fence = open[1];
      continue;
    }
    if (fence !== null) {
      const close = FENCE.exec(line);
      if (
        close &&
        close[1][0] === fence[0] &&
        close[1].length >= fence.length &&
        line.trim() === close[1]
      )
        fence = null;
      continue;
    }
    for (const match of line.matchAll(/<[a-z][^>]*\s(?:id|name)="([^"]+)"/gi))
      anchors.add(match[1]);
    const heading = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (heading === null) continue;
    const base = slugify(heading[1]);
    let slug = base;
    let count = counts.get(base) ?? 0;
    while (anchors.has(slug)) {
      count += 1;
      slug = `${base}-${count}`;
    }
    counts.set(base, count);
    anchors.add(slug);
  }
  anchorCache.set(file, anchors);
  return anchors;
}

export function extractLinks(source) {
  const links = [];
  for (const { number, text } of proseLines(source)) {
    for (const match of text.matchAll(
      /\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
    )) {
      links.push({ line: number, target: match[1].replace(/^<|>$/g, "") });
    }
    const reference = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/.exec(text);
    if (reference) links.push({ line: number, target: reference[1].replace(/^<|>$/g, "") });
    for (const match of text.matchAll(/\s(?:href|src)="([^"]+)"/gi))
      links.push({ line: number, target: match[1] });
  }
  return links;
}

export function checkLink(file, target) {
  if (target === "" || SCHEME.test(target) || target.startsWith("//")) return null;
  const hash = target.indexOf("#");
  const rawPath = hash === -1 ? target : target.slice(0, hash);
  const fragment = hash === -1 ? null : target.slice(hash + 1);
  let path;
  try {
    path = decodeURIComponent(rawPath.split("?")[0]);
  } catch {
    return `malformed link ${target}`;
  }
  const resolved =
    path === "" ? file : path.startsWith("/") ? join(ROOT, path) : resolve(dirname(file), path);
  if (!existsSync(resolved))
    return `missing file ${relative(ROOT, resolved).split("\\").join("/")}`;
  if (fragment === null || fragment === "") return null;
  if (statSync(resolved).isDirectory() || extname(resolved) !== ".md") return null;
  let anchor;
  try {
    anchor = decodeURIComponent(fragment);
  } catch {
    return `malformed anchor #${fragment}`;
  }
  if (!anchorsOf(resolved).has(anchor)) {
    return `missing anchor #${anchor} in ${relative(ROOT, resolved).split("\\").join("/")}`;
  }
  return null;
}

export function checkLinks(targets = DEFAULT_TARGETS) {
  const files = targets.flatMap((target) => markdownFiles(resolve(ROOT, target)));
  const problems = [];
  let count = 0;
  for (const file of files) {
    for (const link of extractLinks(readFileSync(file, "utf8"))) {
      if (SCHEME.test(link.target) || link.target.startsWith("//")) continue;
      count += 1;
      const problem = checkLink(file, link.target);
      if (problem !== null) {
        problems.push(
          `${relative(ROOT, file).split("\\").join("/")}:${link.line}  ${link.target}  ${problem}`,
        );
      }
    }
  }
  return { files: files.length, links: count, problems };
}

export function main(argv = process.argv.slice(2)) {
  const targets = argv.filter((arg) => !arg.startsWith("-"));
  const result = checkLinks(targets.length > 0 ? targets : DEFAULT_TARGETS);
  if (result.problems.length > 0) {
    process.stderr.write(`${result.problems.map((problem) => `${problem}\n`).join("")}`);
    process.stderr.write(
      `${result.problems.length} broken local link${result.problems.length === 1 ? "" : "s"} in ${result.files} files\n`,
    );
    return 1;
  }
  process.stdout.write(
    `checked ${result.links} local links in ${result.files} files: no broken links\n`,
  );
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
  process.exitCode = main();
}
