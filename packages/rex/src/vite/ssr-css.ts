import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePath } from "vite";
import type { RexDocumentAssets, RexPageAssets } from "../server/ssr.ts";
import { pageIdOfModule } from "./split.ts";
import { DEFAULT_APP_DIR, PAGE_CHUNK_PREFIX } from "./virtual.ts";

export const CLIENT_MANIFEST_FILE = ".vite/manifest.json";

export interface ViteManifestChunk {
  readonly file: string;
  readonly src?: string;
  readonly name?: string;
  readonly isEntry?: boolean;
  readonly isDynamicEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly css?: readonly string[];
}

export type ViteManifest = Readonly<Record<string, ViteManifestChunk>>;

export interface SsrAssetsOptions {
  readonly root: string;
  readonly appDir?: string;
  readonly base?: string;
}

export class RexClientManifestError extends Error {
  constructor(message: string) {
    super(`rex client manifest: ${message}`);
    this.name = "RexClientManifestError";
  }
}

export function readClientManifest(clientDir: string): ViteManifest {
  const file = join(clientDir, CLIENT_MANIFEST_FILE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new RexClientManifestError(`cannot read ${file}: ${(error as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RexClientManifestError(`${file} is not a Vite manifest object`);
  }
  return parsed as ViteManifest;
}

interface Collected {
  readonly css: Set<string>;
  readonly js: Set<string>;
}

function collect(manifest: ViteManifest, key: string, into: Collected, seen: Set<string>): void {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (chunk === undefined) return;
  into.js.add(chunk.file);
  for (const sheet of chunk.css ?? []) into.css.add(sheet);
  for (const imported of chunk.imports ?? []) collect(manifest, imported, into, seen);
}

function pageIdOf(chunk: ViteManifestChunk, root: string, appPath: string): string | null {
  if (chunk.isEntry === true) return null;
  if (chunk.src !== undefined) {
    const fromSource = pageIdOfModule(normalizePath(join(root, chunk.src)), appPath);
    if (fromSource !== null) return fromSource;
  }
  if (chunk.name !== undefined && chunk.name.startsWith(PAGE_CHUNK_PREFIX)) {
    return chunk.name.slice(PAGE_CHUNK_PREFIX.length);
  }
  return null;
}

function sorted(values: Iterable<string>, base: string, exclude: ReadonlySet<string>): string[] {
  return [...values]
    .filter((value) => !exclude.has(value))
    .sort()
    .map((value) => `${base}${value}`);
}

export function ssrAssetsFromManifest(
  manifest: ViteManifest,
  options: SsrAssetsOptions,
): RexDocumentAssets {
  const base = options.base ?? "/";
  const appPath = normalizePath(join(options.root, options.appDir ?? DEFAULT_APP_DIR));
  const entries = Object.keys(manifest).filter((key) => manifest[key]?.isEntry === true);
  if (entries.length !== 1) {
    throw new RexClientManifestError(`expected one entry chunk, found ${entries.length}`);
  }
  const entryKey = entries[0] as string;
  const entryChunk = manifest[entryKey] as ViteManifestChunk;
  const entry: Collected = { css: new Set(), js: new Set() };
  collect(manifest, entryKey, entry, new Set());
  const entryFiles = new Set([...entry.js, ...entry.css]);

  const byPage = new Map<string, Collected>();
  for (const [key, chunk] of Object.entries(manifest)) {
    const page = pageIdOf(chunk, options.root, appPath);
    if (page === null) continue;
    const collected = byPage.get(page) ?? { css: new Set<string>(), js: new Set<string>() };
    collect(manifest, key, collected, new Set());
    byPage.set(page, collected);
  }
  const pages: Record<string, RexPageAssets> = {};
  for (const page of [...byPage.keys()].sort()) {
    const collected = byPage.get(page) as Collected;
    pages[page] = Object.freeze({
      stylesheets: Object.freeze(sorted(collected.css, base, entryFiles)),
      preloads: Object.freeze(sorted(collected.js, base, entryFiles)),
    });
  }
  const entryImports = new Set([...entry.js].filter((file) => file !== entryChunk.file));
  return Object.freeze({
    scripts: Object.freeze([`${base}${entryChunk.file}`]),
    stylesheets: Object.freeze(sorted(entry.css, base, new Set())),
    preloads: Object.freeze(sorted(entryImports, base, new Set())),
    pages: Object.freeze(pages),
  });
}

export function readSsrAssets(clientDir: string, options: SsrAssetsOptions): RexDocumentAssets {
  return ssrAssetsFromManifest(readClientManifest(clientDir), options);
}
