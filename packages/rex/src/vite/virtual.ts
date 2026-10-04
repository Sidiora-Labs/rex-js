import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";
import type { AnyAction } from "../core/action.ts";
import type { AnyEntity } from "../core/entity.ts";
import type { AnyFlow } from "../core/flow.ts";
import { isValidName } from "../core/ids.ts";
import type { AnyPage } from "../core/page.ts";
import type { AnyPolicy } from "../core/policy.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";

export const APP_MODULE_ID = "rex:app";
export const RESOLVED_APP_MODULE_ID = "\0rex:app";
export const ENTRY_MODULE_ID = "/@rex/entry";
export const RESOLVED_ENTRY_MODULE_ID = "\0rex:entry";
export const DEFAULT_APP_DIR = "app";
export const ROOT_ELEMENT_ID = "root";
export const CORE_SPECIFIER = "@sidioralabs/rex";
export const CLIENT_SPECIFIER = "@sidioralabs/rex/client";
export const RUNTIME_STYLESHEETS = ["tokens.css", "agent/density.css"] as const;

export const DECLARATION_FOLDERS = {
  entity: "entities",
  action: "actions",
  policy: "policies",
  flow: "flows",
} as const;

export const PAGE_FILES = ["page.ts", "view.tsx", "states.tsx"] as const;

export interface RexPageModule {
  readonly id: string;
  readonly page: AnyPage;
  readonly view: unknown;
  readonly states: Readonly<Record<string, unknown>>;
  readonly regions: Readonly<Record<string, unknown>>;
  readonly overlays: Readonly<Record<string, unknown>>;
}

export interface RexAppBundle {
  readonly name: string;
  readonly entities: readonly AnyEntity[];
  readonly actions: readonly AnyAction[];
  readonly policies: readonly AnyPolicy[];
  readonly flows: readonly AnyFlow[];
  readonly pages: readonly RexPageModule[];
  readonly registry: RegistrySnapshot;
  readonly manifest: Manifest;
}

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

export interface RuntimePaths {
  readonly core: string;
  readonly client: string;
}

export function runtimePaths(from: string = import.meta.url): RuntimePaths {
  const extension = from.endsWith(".ts") ? ".ts" : ".js";
  const source = dirname(dirname(fileURLToPath(from)));
  return {
    core: normalizePath(join(source, `index${extension}`)),
    client: normalizePath(join(source, "client", `index${extension}`)),
  };
}

export interface AppModuleOptions {
  readonly name: string;
  readonly core: string;
}

const APP_HELPERS = `function rexFail(file, problem) {
  throw new Error("rex:app: " + file + " " + problem);
}
function rexDeclarations(namespace, kind, file) {
  const found = [];
  for (const key of Object.keys(namespace).sort()) {
    const value = namespace[key];
    if (value !== null && typeof value === "object" && value.kind === kind && !found.includes(value)) {
      found.push(value);
    }
  }
  if (found.length === 0) rexFail(file, "exports no " + kind + " declaration");
  return found;
}
function rexDefault(namespace, file) {
  if (namespace.default === undefined) rexFail(file, "has no default export");
  return namespace.default;
}
function rexPage(id, namespace, file, view, states, regions, overlays) {
  const declared = rexDeclarations(namespace, "page", file);
  if (declared.length !== 1) {
    rexFail(file, "must export exactly one page declaration, found " + declared.length);
  }
  const page = declared[0];
  if (page.id !== id) {
    rexFail(file, "declares page " + JSON.stringify(page.id) + " but its folder is " + JSON.stringify(id));
  }
  return Object.freeze({
    id,
    page,
    view,
    states: Object.freeze({ ...states }),
    regions: Object.freeze(regions),
    overlays: Object.freeze(overlays),
  });
}`;

export function generateAppModule(scan: AppScan, options: AppModuleOptions): string {
  const literal = (value: string) => JSON.stringify(value);
  const display = (file: string) => literal(normalizePath(relative(scan.root, file)));
  const imports: string[] = [
    `import { buildManifest, createRegistry } from ${literal(options.core)};`,
  ];
  const lists: Record<keyof typeof DECLARATION_FOLDERS, string[]> = {
    entity: [],
    action: [],
    policy: [],
    flow: [],
  };
  for (const kind of Object.keys(DECLARATION_FOLDERS) as (keyof typeof DECLARATION_FOLDERS)[]) {
    const files = scan[DECLARATION_FOLDERS[kind]];
    files.forEach((file, index) => {
      const binding = `${kind}${index}`;
      imports.push(`import * as ${binding} from ${literal(file)};`);
      lists[kind].push(`...rexDeclarations(${binding}, ${literal(kind)}, ${display(file)})`);
    });
  }
  const pageEntries = scan.pages.map((scanned, index) => {
    const base = `page${index}`;
    imports.push(`import * as ${base} from ${literal(scanned.page)};`);
    imports.push(`import * as ${base}View from ${literal(scanned.view)};`);
    imports.push(`import * as ${base}States from ${literal(scanned.states)};`);
    const regions = scanned.regions.map((region, regionIndex) => {
      const binding = `${base}Region${regionIndex}`;
      imports.push(`import * as ${binding} from ${literal(region.file)};`);
      return `${literal(region.name)}: rexDefault(${binding}, ${display(region.file)})`;
    });
    const overlays = scanned.overlays.map((overlay, overlayIndex) => {
      const binding = `${base}Overlay${overlayIndex}`;
      imports.push(`import * as ${binding} from ${literal(overlay.file)};`);
      return `${literal(overlay.name)}: rexDefault(${binding}, ${display(overlay.file)})`;
    });
    return `rexPage(${literal(scanned.id)}, ${base}, ${display(scanned.page)}, rexDefault(${base}View, ${display(scanned.view)}), ${base}States, { ${regions.join(", ")} }, { ${overlays.join(", ")} })`;
  });
  const list = (items: readonly string[]) =>
    items.length === 0 ? "Object.freeze([])" : `Object.freeze([\n  ${items.join(",\n  ")},\n])`;
  return [
    ...imports,
    "",
    APP_HELPERS,
    "",
    `export const entities = ${list(lists.entity)};`,
    `export const actions = ${list(lists.action)};`,
    `export const policies = ${list(lists.policy)};`,
    `export const flows = ${list(lists.flow)};`,
    `export const pages = ${list(pageEntries)};`,
    "export const registry = createRegistry()",
    "  .register(...entities, ...actions, ...policies, ...flows, ...pages.map((entry) => entry.page))",
    "  .freeze();",
    `export const manifest = buildManifest(registry, { app: ${literal(options.name)} });`,
    `export const app = Object.freeze({ name: ${literal(options.name)}, entities, actions, policies, flows, pages, registry, manifest });`,
    "export default app;",
    "",
  ].join("\n");
}

export interface EntryModuleOptions {
  readonly client: string;
  readonly rootElement?: string;
}

export function runtimeStylesheets(client: string): readonly string[] {
  const dir = dirname(client);
  return RUNTIME_STYLESHEETS.map((file) => normalizePath(join(dir, file)));
}

export function generateEntryModule(options: EntryModuleOptions): string {
  const rootElement = options.rootElement ?? ROOT_ELEMENT_ID;
  return [
    ...runtimeStylesheets(options.client).map((file) => `import ${JSON.stringify(file)};`),
    'import { StrictMode, createElement } from "react";',
    'import { createRoot } from "react-dom/client";',
    `import { createRexEntry } from ${JSON.stringify(options.client)};`,
    `import app from ${JSON.stringify(APP_MODULE_ID)};`,
    "",
    `const container = document.getElementById(${JSON.stringify(rootElement)});`,
    "if (container === null) {",
    `  throw new Error(${JSON.stringify(`rex: index.html has no element with id "${rootElement}"`)});`,
    "}",
    "const RexEntry = createRexEntry(app);",
    "createRoot(container).render(createElement(StrictMode, null, createElement(RexEntry)));",
    "",
  ].join("\n");
}
