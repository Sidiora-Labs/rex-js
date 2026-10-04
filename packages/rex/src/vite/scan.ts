import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { join, relative, resolve } from "node:path";
import { normalizePath } from "vite";
import { isValidName } from "../core/ids.ts";
import { DEFAULT_APP_DIR } from "./virtual.ts";

export const DECLARATION_FOLDERS = {
  entity: "entities",
  action: "actions",
  policy: "policies",
  flow: "flows",
} as const;

export const PAGE_FILES = ["page.ts", "view.tsx", "states.tsx"] as const;

export interface ScannedNamedFile {
  readonly name: string;
  readonly file: string;
}

export interface ScannedPage {
  readonly id: string;
  readonly dir: string;
  readonly page: string;
  readonly view: string;
  readonly states: string;
  readonly regions: readonly ScannedNamedFile[];
  readonly overlays: readonly ScannedNamedFile[];
}

export interface AppScan {
  readonly root: string;
  readonly appDir: string;
  readonly entities: readonly string[];
  readonly actions: readonly string[];
  readonly policies: readonly string[];
  readonly flows: readonly string[];
  readonly pages: readonly ScannedPage[];
}

export class RexAppScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RexAppScanError";
  }
}

function byName(a: Dirent, b: Dirent): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function entries(dir: string): Dirent[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).sort(byName);
}

function isModuleFile(name: string, extension: ".ts" | ".tsx"): boolean {
  return (
    name.endsWith(extension) &&
    !name.endsWith(`.test${extension}`) &&
    !name.endsWith(`.d${extension}`)
  );
}

function declarationFiles(dir: string): string[] {
  return entries(dir)
    .filter((entry) => entry.isFile() && isModuleFile(entry.name, ".ts"))
    .map((entry) => normalizePath(join(dir, entry.name)));
}

function scanPage(root: string, pagesDir: string, id: string): ScannedPage {
  const dir = join(pagesDir, id);
  const display = normalizePath(relative(root, dir));
  if (!isValidName(id)) {
    throw new RexAppScanError(
      `${display}: a page folder is named after its page id (lowercase letters, digits, dot and dash)`,
    );
  }
  const missing = PAGE_FILES.filter((file) => !existsSync(join(dir, file)));
  if (missing.length > 0) {
    throw new RexAppScanError(`${display} is missing ${missing.join(", ")}`);
  }
  const regions = entries(join(dir, "regions"))
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(dir, "regions", entry.name, "region.tsx")),
    )
    .map((entry) => ({
      name: entry.name,
      file: normalizePath(join(dir, "regions", entry.name, "region.tsx")),
    }));
  const overlays = entries(join(dir, "overlays"))
    .filter((entry) => entry.isFile() && isModuleFile(entry.name, ".tsx"))
    .map((entry) => ({
      name: entry.name.slice(0, -".tsx".length),
      file: normalizePath(join(dir, "overlays", entry.name)),
    }));
  return {
    id,
    dir: normalizePath(dir),
    page: normalizePath(join(dir, "page.ts")),
    view: normalizePath(join(dir, "view.tsx")),
    states: normalizePath(join(dir, "states.tsx")),
    regions,
    overlays,
  };
}

export function scanApp(root: string, appDir: string = DEFAULT_APP_DIR): AppScan {
  const absoluteRoot = resolve(root);
  const appPath = resolve(absoluteRoot, appDir);
  if (!existsSync(appPath) || !statSync(appPath).isDirectory()) {
    throw new RexAppScanError(`no app directory at ${normalizePath(appPath)}`);
  }
  const pagesDir = join(appPath, "pages");
  const pages = entries(pagesDir)
    .filter((entry) => entry.isDirectory())
    .map((entry) => scanPage(absoluteRoot, pagesDir, entry.name));
  return {
    root: normalizePath(absoluteRoot),
    appDir: normalizePath(appPath),
    entities: declarationFiles(join(appPath, DECLARATION_FOLDERS.entity)),
    actions: declarationFiles(join(appPath, DECLARATION_FOLDERS.action)),
    policies: declarationFiles(join(appPath, DECLARATION_FOLDERS.policy)),
    flows: declarationFiles(join(appPath, DECLARATION_FOLDERS.flow)),
    pages,
  };
}
