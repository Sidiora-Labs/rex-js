#!/usr/bin/env node
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DIST_DIR = "dist";
export const CLIENT_DIR = "client";
export const MANIFEST_FILE = "rex/manifest";
export const PRERENDER_LIST_FILE = "prerender.json";
export const CNAME_FILE = "CNAME";
export const SITEMAP_FILE = "sitemap.xml";
export const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

const XML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character]);
}

export function sitemapPath(path) {
  return path === "/" || path.endsWith("/") ? path : `${path}/`;
}

export function sitemapPaths(manifest, prerender) {
  const paths = new Set();
  for (const listed of manifest.pages) {
    if (listed.routeParams.length === 0) paths.add(sitemapPath(listed.route));
  }
  for (const entry of prerender.pages) paths.add(sitemapPath(entry.path));
  return [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function sitemapXml(origin, paths) {
  const urls = paths.map(
    (path) => `  <url>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>\n  </url>\n`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_NAMESPACE}">\n${urls.join("")}</urlset>\n`;
}

export function readHost(clientDir) {
  const host = readFileSync(join(clientDir, CNAME_FILE), "utf8").trim();
  if (host === "" || /\s/.test(host)) {
    throw new Error(
      `sitemap: ${CNAME_FILE} must hold one host name, found ${JSON.stringify(host)}`,
    );
  }
  return host;
}

export function writeSitemap(siteDir = process.cwd()) {
  const distDir = resolve(siteDir, DIST_DIR);
  const clientDir = join(distDir, CLIENT_DIR);
  const manifest = JSON.parse(readFileSync(join(clientDir, MANIFEST_FILE), "utf8"));
  const prerender = JSON.parse(readFileSync(join(distDir, PRERENDER_LIST_FILE), "utf8"));
  const paths = sitemapPaths(manifest, prerender);
  const file = join(clientDir, SITEMAP_FILE);
  writeFileSync(file, sitemapXml(`https://${readHost(clientDir)}`, paths), "utf8");
  return { file, paths };
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
  try {
    const written = writeSitemap();
    process.stdout.write(
      `sitemap: wrote ${DIST_DIR}/${CLIENT_DIR}/${SITEMAP_FILE} with ${written.paths.length} URL${written.paths.length === 1 ? "" : "s"}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
