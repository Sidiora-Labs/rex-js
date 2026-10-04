import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";
import type { AnyFlow } from "../core/flow.ts";
import {
  DECLARATION_KINDS,
  createRegistry,
  type AnyDeclaration,
  type RegistrySnapshot,
} from "../core/registry.ts";
import { renderAgentsMd } from "./agents-md.ts";
import { buildManifest, stableStringify } from "./build.ts";
import type { Manifest } from "./types.ts";

export const MANIFEST_DIR = ".rex";
export const MANIFEST_FILE = ".rex/manifest.json";
export const AGENTS_FILE = "AGENTS.md";
export const SCAN_TIMEOUT_MS = 60_000;

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

export async function loadRegistry(appRoot: string): Promise<RegistrySnapshot> {
  const root = path.resolve(appRoot);
  const files = declarationFiles(root);
  const tsconfig = path.join(root, "tsconfig.json");
  const api = register({
    namespace: `rex-scan-${randomUUID()}`,
    tsconfig: existsSync(tsconfig) ? tsconfig : false,
  });
  const registry = createRegistry();
  try {
    for (const file of files) {
      let loaded: Record<string, unknown>;
      try {
        loaded = (await api.import(pathToFileURL(file).href, import.meta.url)) as Record<
          string,
          unknown
        >;
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
  } finally {
    await api.unregister();
  }
  return registry.freeze();
}

export async function buildAppManifest(appRoot: string): Promise<Manifest> {
  const snapshot = await loadRegistry(appRoot);
  return buildManifest(snapshot, { app: appName(appRoot) });
}

const CHILD_SOURCE = `
let result;
try {
  const { buildAppManifest } = await import(process.env.REX_SCAN_MODULE);
  result = { ok: true, manifest: await buildAppManifest(process.env.REX_SCAN_ROOT) };
} catch (error) {
  result = { ok: false, error: error instanceof Error ? error.message : String(error) };
}
process.send(result, () => process.exit(0));
`;

type ChildMessage =
  | { readonly ok: true; readonly manifest: Manifest }
  | { readonly ok: false; readonly error: string };

export function scanManifest(appRoot: string): Promise<Manifest> {
  const root = path.resolve(appRoot);
  declarationFiles(root);
  const require = createRequire(import.meta.url);
  const loader = pathToFileURL(require.resolve("tsx")).href;
  return new Promise<Manifest>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", loader, "--input-type=module", "--eval", CHILD_SOURCE],
      {
        cwd: root,
        env: {
          ...process.env,
          REX_SCAN_MODULE: import.meta.url,
          REX_SCAN_ROOT: root,
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    let message: ChildMessage | null = null;
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ManifestScanError(root, `timed out after ${SCAN_TIMEOUT_MS} ms`));
    }, SCAN_TIMEOUT_MS);
    child.stdout?.resume();
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("message", (received) => {
      message = received as ChildMessage;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = message as ChildMessage | null;
      if (result?.ok) resolve(result.manifest);
      else if (result) reject(new ManifestScanError(root, result.error));
      else {
        reject(
          new ManifestScanError(
            root,
            `the scan process exited with code ${code} without a result${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
      }
    });
  });
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
