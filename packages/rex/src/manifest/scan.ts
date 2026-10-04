import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { withModuleLoader, type ModuleLoader } from "../cli/load.ts";
import type { AnyFlow } from "../core/flow.ts";
import {
  DECLARATION_KINDS,
  type AnyDeclaration,
  type RegistrySnapshot,
} from "../core/registry.ts";
import { runtimePaths } from "../vite/resolve.ts";
import { CORE_SPECIFIER } from "../vite/virtual.ts";
import { renderAgentsMd } from "./agents-md.ts";
import { stableStringify } from "./build.ts";
import type { Manifest } from "./types.ts";

export const MANIFEST_DIR = ".rex";
export const MANIFEST_FILE = ".rex/manifest.json";
export const AGENTS_FILE = "AGENTS.md";

const DECLARATION_DIRS = ["entities", "policies", "actions", "flows"] as const;

export class ManifestScanError extends Error {
  readonly appRoot: string;

  constructor(appRoot: string, message: string) {
    super(`manifest scan of ${appRoot} failed: ${message}`);
    this.name = "ManifestScanError";
    this.appRoot = appRoot;
  }
}

export interface ManifestFiles {
  readonly manifest: string;
  readonly agents: string;
}

export interface WriteManifestResult {
  readonly manifest: Manifest;
  readonly files: ManifestFiles;
  readonly manifestPath: string;
  readonly agentsPath: string;
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function sourceFiles(dir: string): string[] {
  if (!isDirectory(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts") &&
        !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

export function declarationFiles(appRoot: string): string[] {
  const appDir = path.join(path.resolve(appRoot), "app");
  if (!isDirectory(appDir)) {
    throw new ManifestScanError(path.resolve(appRoot), `no app directory at ${appDir}`);
  }
  const files = DECLARATION_DIRS.flatMap((dir) => sourceFiles(path.join(appDir, dir)));
  const pagesDir = path.join(appDir, "pages");
  if (isDirectory(pagesDir)) {
    for (const entry of readdirSync(pagesDir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const pageFile = path.join(pagesDir, entry.name, "page.ts");
      if (entry.isDirectory() && existsSync(pageFile)) files.push(pageFile);
    }
  }
  return files;
}

function isDeclaration(value: unknown): value is AnyDeclaration | AnyFlow {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; id?: unknown };
  return (
    typeof candidate.kind === "string" &&
    (DECLARATION_KINDS as readonly string[]).includes(candidate.kind) &&
    typeof candidate.id === "string"
  );
}

export function appName(appRoot: string): string {
  const packageFile = path.join(path.resolve(appRoot), "package.json");
  if (existsSync(packageFile)) {
    const parsed = JSON.parse(readFileSync(packageFile, "utf8")) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name.trim() !== "") return parsed.name;
  }
  return path.basename(path.resolve(appRoot));
}

type AppCore = Pick<typeof import("../index.ts"), "buildManifest" | "createRegistry">;

async function loadAppCore(loader: ModuleLoader): Promise<AppCore> {
  const resolved = await loader.vite.environments.ssr.pluginContainer.resolveId(
    CORE_SPECIFIER,
    path.join(loader.root, "index.html"),
  );
  const core =
    resolved === null || resolved.external || !path.isAbsolute(resolved.id)
      ? runtimePaths().core
      : resolved.id;
  return loader.load<AppCore>(core);
}

async function loadDeclarations(
  root: string,
  loader: ModuleLoader,
  core: AppCore,
): Promise<RegistrySnapshot> {
  const registry = core.createRegistry();
  for (const file of declarationFiles(root)) {
    let loaded: Record<string, unknown>;
    try {
      loaded = await loader.load(`/${path.relative(root, file).split(path.sep).join("/")}`);
    } catch (error) {
      throw new ManifestScanError(
        root,
        `cannot import ${path.relative(root, file)}: ${(error as Error).message}`,
      );
    }
    for (const key of Object.keys(loaded).sort()) {
      const value = loaded[key];
      if (isDeclaration(value)) registry.register(value as AnyDeclaration);
    }
  }
  return registry.freeze();
}

export async function loadRegistry(appRoot: string): Promise<RegistrySnapshot> {
  const root = path.resolve(appRoot);
  declarationFiles(root);
  return withModuleLoader(root, async (loader) =>
    loadDeclarations(root, loader, await loadAppCore(loader)),
  );
}

export async function buildAppManifest(appRoot: string): Promise<Manifest> {
  const root = path.resolve(appRoot);
  declarationFiles(root);
  return withModuleLoader(root, async (loader) => {
    const core = await loadAppCore(loader);
    const snapshot = await loadDeclarations(root, loader, core);
    return core.buildManifest(snapshot, { app: appName(root) });
  });
}

export async function scanManifest(appRoot: string): Promise<Manifest> {
  const root = path.resolve(appRoot);
  try {
    return await buildAppManifest(root);
  } catch (error) {
    if (error instanceof ManifestScanError) throw error;
    throw new ManifestScanError(root, error instanceof Error ? error.message : String(error));
  }
}

export function renderManifestFiles(manifest: Manifest): ManifestFiles {
  return {
    manifest: `${stableStringify(manifest)}\n`,
    agents: renderAgentsMd(manifest),
  };
}

export async function writeManifest(appRoot: string): Promise<WriteManifestResult> {
  const root = path.resolve(appRoot);
  const manifest = await scanManifest(root);
  const files = renderManifestFiles(manifest);
  const manifestPath = path.join(root, MANIFEST_FILE);
  const agentsPath = path.join(root, AGENTS_FILE);
  mkdirSync(path.join(root, MANIFEST_DIR), { recursive: true });
  writeFileSync(manifestPath, files.manifest);
  writeFileSync(agentsPath, files.agents);
  return { manifest, files, manifestPath, agentsPath };
}
