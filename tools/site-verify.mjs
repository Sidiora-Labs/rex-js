#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { INDEX_PAGE, NOT_FOUND_PAGE, resolveRequest } from "./serve-static.mjs";

export const CNAME_FILE = "CNAME";
export const ROBOTS_FILE = "robots.txt";
export const MANIFEST_FILE = "rex/manifest";
export const SITEMAP_FILE = "sitemap.xml";
export const OG_IMAGE_FILE = "og.png";
export const PRERENDER_LIST_FILE = "prerender.json";
export const REQUIRED_FILES = Object.freeze([
  CNAME_FILE,
  ROBOTS_FILE,
  NOT_FOUND_PAGE,
  MANIFEST_FILE,
  SITEMAP_FILE,
  OG_IMAGE_FILE,
]);
export const PRERENDER_MODES = Object.freeze(["ssg", "static"]);

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const TAG = /<([a-z][a-z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SCRIPT_BODY = /(<script\b(?:[^>"']|"[^"]*"|'[^']*')*>)[\s\S]*?(<\/script\s*>)/gi;
const STYLE_BODY = /(<style\b(?:[^>"']|"[^"]*"|'[^']*')*>)[\s\S]*?(<\/style\s*>)/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const LINK_ATTRIBUTES = new Set(["href", "src"]);
const META_LINKS = new Set(["og:url", "og:image", "twitter:image"]);
const SIDECAR = /<script\b(?=[^>]*\btype="application\/rex\+json")(?=[^>]*\bid="rex-page")[^>]*>/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function toPosix(path) {
  return path.split("\\").join("/");
}

export function htmlFiles(root, dir = root) {
  const files = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...htmlFiles(root, path));
    else if (name.endsWith(".html")) files.push(toPosix(relative(root, path)));
  }
  return files;
}

export function pageFile(path) {
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (trimmed === "/") return INDEX_PAGE;
  const segments = trimmed
    .slice(1)
    .split("/")
    .map((segment) => decodeURIComponent(segment));
  return [...segments, INDEX_PAGE].join("/");
}

export function documentPath(file) {
  if (file === NOT_FOUND_PAGE) return "/";
  if (file === INDEX_PAGE) return "/";
  if (file.endsWith(`/${INDEX_PAGE}`)) return `/${file.slice(0, -INDEX_PAGE.length)}`;
  return `/${file}`;
}

export function extractLinks(html) {
  const source = html.replace(COMMENT, "").replace(SCRIPT_BODY, "$1$2").replace(STYLE_BODY, "$1$2");
  const links = [];
  for (const tag of source.matchAll(TAG)) {
    const name = tag[1].toLowerCase();
    const attributes = new Map();
    for (const attribute of tag[2].matchAll(ATTRIBUTE)) {
      const value = attribute[2] ?? attribute[3] ?? attribute[4];
      if (value !== undefined) attributes.set(attribute[1].toLowerCase(), decodeEntities(value));
    }
    for (const [key, value] of attributes) {
      if (LINK_ATTRIBUTES.has(key)) links.push({ tag: name, attribute: key, target: value });
    }
    if (name === "meta") {
      const property = attributes.get("property") ?? attributes.get("name");
      const content = attributes.get("content");
      if (property !== undefined && META_LINKS.has(property) && content !== undefined) {
        links.push({ tag: name, attribute: property, target: content });
      }
    }
  }
  return links;
}

export function internalPath(target, base, host) {
  const trimmed = target.trim();
  if (trimmed === "" || trimmed.startsWith("#")) return null;
  if (trimmed.startsWith("//") || SCHEME.test(trimmed)) {
    let url;
    try {
      url = new URL(trimmed, `https://${host}`);
    } catch {
      return { problem: `malformed URL ${target}` };
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname.toLowerCase() !== host) return null;
    return { pathname: url.pathname };
  }
  let url;
  try {
    url = new URL(trimmed, `https://${host}${base}`);
  } catch {
    return { problem: `malformed URL ${target}` };
  }
  return { pathname: url.pathname };
}

function readJson(file, label, problems) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function readCname(root, problems) {
  const file = join(root, CNAME_FILE);
  if (!isFile(file)) return null;
  const lines = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length !== 1 || !HOSTNAME.test(lines[0])) {
    problems.push(`${CNAME_FILE} must hold exactly one host name, found ${JSON.stringify(lines)}`);
    return null;
  }
  return lines[0].toLowerCase();
}

function checkRobots(root, host, problems) {
  const file = join(root, ROBOTS_FILE);
  if (!isFile(file) || host === null) return;
  const expected = `https://${host}/${SITEMAP_FILE}`;
  const sitemaps = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line))
    .filter((match) => match !== null)
    .map((match) => match[1]);
  if (!sitemaps.includes(expected)) {
    problems.push(`${ROBOTS_FILE} does not name the sitemap ${expected}`);
  }
}

function manifestPages(manifest, problems) {
  if (manifest === null) return [];
  if (typeof manifest !== "object" || !Array.isArray(manifest.pages)) {
    problems.push(`${MANIFEST_FILE} has no pages list`);
    return [];
  }
  return manifest.pages.filter((listed) => {
    const valid =
      typeof listed === "object" &&
      listed !== null &&
      typeof listed.id === "string" &&
      typeof listed.route === "string" &&
      Array.isArray(listed.routeParams) &&
      typeof listed.render === "string";
    if (!valid)
      problems.push(`${MANIFEST_FILE} lists a page without id, route, routeParams and render`);
    return valid;
  });
}

function prerenderedPages(list, problems, label) {
  if (list === null) return [];
  if (typeof list !== "object" || !Array.isArray(list.pages)) {
    problems.push(`${label} has no pages list`);
    return [];
  }
  return list.pages.filter((entry) => {
    const valid =
      typeof entry === "object" &&
      entry !== null &&
      typeof entry.path === "string" &&
      typeof entry.page === "string" &&
      typeof entry.file === "string";
    if (!valid) problems.push(`${label} lists an entry without path, page and file`);
    return valid;
  });
}

export function expectedDocuments(pages, prerendered) {
  const documents = new Map();
  for (const listed of pages) {
    if (listed.routeParams.length === 0) {
      documents.set(listed.route, { path: listed.route, page: listed.id, prerendered: false });
    }
  }
  for (const entry of prerendered) {
    documents.set(entry.path, { path: entry.path, page: entry.page, prerendered: true });
  }
  return [...documents.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) => decodeEntities(match[1]));
}

function sitemapPath(path) {
  return path === "/" || path.endsWith("/") ? path : `${path}/`;
}

function checkSitemap(root, host, documents, problems) {
  const file = join(root, SITEMAP_FILE);
  if (!isFile(file) || host === null) return;
  const xml = readFileSync(file, "utf8");
  if (!/<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) {
    problems.push(`${SITEMAP_FILE} has no urlset in the sitemaps.org 0.9 namespace`);
  }
  const listed = new Set();
  for (const location of sitemapLocations(xml)) {
    let url;
    try {
      url = new URL(location);
    } catch {
      problems.push(`${SITEMAP_FILE} lists a malformed URL ${location}`);
      continue;
    }
    if (url.protocol !== "https:" || url.hostname !== host) {
      problems.push(`${SITEMAP_FILE} lists ${location}, which is not on https://${host}`);
      continue;
    }
    if (listed.has(url.pathname)) problems.push(`${SITEMAP_FILE} lists ${location} twice`);
    listed.add(url.pathname);
    const resolved = resolveRequest(root, url.pathname);
    if (resolved.kind !== "file") {
      problems.push(
        `${SITEMAP_FILE} lists ${location}, which the static host does not answer with a page`,
      );
    }
  }
  for (const document of documents) {
    const path = sitemapPath(document.path);
    if (!listed.has(path))
      problems.push(`${SITEMAP_FILE} does not list ${path} (page ${document.page})`);
  }
}

function checkDocuments(root, pages, prerendered, documents, problems) {
  for (const listed of pages) {
    if (listed.routeParams.length === 0) continue;
    if (!PRERENDER_MODES.includes(listed.render)) continue;
    if (!prerendered.some((entry) => entry.page === listed.id)) {
      problems.push(
        `page ${listed.id} (${listed.route}, ${listed.render}) has no prerendered path`,
      );
    }
  }
  for (const document of documents) {
    const file = pageFile(document.path);
    if (!isFile(join(root, file))) {
      problems.push(`page ${document.page} has no ${file} for ${document.path}`);
      continue;
    }
    if (!document.prerendered) continue;
    const html = readFileSync(join(root, file), "utf8");
    if (!html.includes(`data-rex-page="${document.page}"`)) {
      problems.push(`${file} does not carry data-rex-page="${document.page}"`);
    }
    if (!SIDECAR.test(html)) {
      problems.push(`${file} has no application/rex+json sidecar script with id rex-page`);
    }
  }
}

function checkLinks(root, host, files, problems) {
  let count = 0;
  for (const file of files) {
    const base = documentPath(file);
    for (const link of extractLinks(readFileSync(join(root, file), "utf8"))) {
      const internal = internalPath(link.target, base, host ?? "localhost");
      if (internal === null) continue;
      count += 1;
      if ("problem" in internal) {
        problems.push(`${file}: <${link.tag} ${link.attribute}> ${internal.problem}`);
        continue;
      }
      if (resolveRequest(root, internal.pathname).kind === "not-found") {
        problems.push(
          `${file}: <${link.tag} ${link.attribute}="${link.target}"> resolves to no built file`,
        );
      }
    }
  }
  return count;
}

export function verifySite(dir, options = {}) {
  const root = resolve(dir);
  const problems = [];
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { problems: [`${dir} is not a directory`], documents: 0, files: 0, links: 0 };
  }
  for (const required of REQUIRED_FILES) {
    if (!isFile(join(root, required))) problems.push(`missing ${required}`);
  }
  const host = readCname(root, problems);
  checkRobots(root, host, problems);
  const manifestFile = join(root, MANIFEST_FILE);
  const pages = manifestPages(
    isFile(manifestFile) ? readJson(manifestFile, MANIFEST_FILE, problems) : null,
    problems,
  );
  const prerenderFile = resolve(options.prerender ?? join(root, "..", PRERENDER_LIST_FILE));
  let prerendered = [];
  if (isFile(prerenderFile)) {
    prerendered = prerenderedPages(
      readJson(prerenderFile, prerenderFile, problems),
      problems,
      prerenderFile,
    );
  } else {
    problems.push(`missing the prerender list ${toPosix(prerenderFile)}`);
  }
  const documents = expectedDocuments(pages, prerendered);
  checkDocuments(root, pages, prerendered, documents, problems);
  checkSitemap(root, host, documents, problems);
  const files = htmlFiles(root);
  const links = checkLinks(root, host, files, problems);
  return { problems, documents: documents.length, files: files.length, links };
}

export function parseArgs(argv) {
  const options = { dir: null, prerender: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prerender") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error("site-verify: --prerender needs a file");
      options.prerender = value;
      index += 1;
    } else if (options.dir === null) {
      options.dir = arg;
    } else {
      throw new Error(`site-verify: unexpected argument ${arg}`);
    }
  }
  if (options.dir === null) {
    throw new Error("usage: node tools/site-verify.mjs <dir> [--prerender <prerender.json>]");
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  const result = verifySite(
    options.dir,
    options.prerender === undefined ? {} : { prerender: options.prerender },
  );
  if (result.problems.length > 0) {
    process.stderr.write(result.problems.map((problem) => `site-verify: ${problem}\n`).join(""));
    process.stderr.write(
      `site-verify: ${result.problems.length} problem${result.problems.length === 1 ? "" : "s"} in ${options.dir}\n`,
    );
    return 1;
  }
  process.stdout.write(
    `site-verify: ${options.dir}: ${result.documents} pages, ${result.files} HTML files, ${result.links} internal links resolve\n`,
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
