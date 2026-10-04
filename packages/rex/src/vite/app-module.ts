import { relative } from "node:path";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import type { AnyAction } from "../core/action.ts";
import type { AnyEntity } from "../core/entity.ts";
import type { AnyFlow } from "../core/flow.ts";
import type { AnyPage } from "../core/page.ts";
import type { AnyPolicy } from "../core/policy.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";
import type { RexHookContext } from "./hooks.ts";
import { resolveRuntimeEntry } from "./resolve.ts";
import { DECLARATION_FOLDERS, RexAppScanError, scanApp, type AppScan } from "./scan.ts";
import { APP_MODULE_ID, CORE_SPECIFIER, RESOLVED_APP_MODULE_ID } from "./virtual.ts";

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

const WATCH_EVENTS = ["add", "unlink", "addDir", "unlinkDir"] as const;

export function watchApp(vite: ViteDevServer, appPath: string): void {
  const prefix = `${normalizePath(appPath)}/`;
  const invalidate = (file: string) => {
    const normalized = normalizePath(file);
    if (normalized !== prefix.slice(0, -1) && !normalized.startsWith(prefix)) return;
    let invalidated = false;
    for (const environment of Object.values(vite.environments)) {
      const node = environment.moduleGraph.getModuleById(RESOLVED_APP_MODULE_ID);
      if (node !== undefined) {
        environment.moduleGraph.invalidateModule(node);
        invalidated = true;
      }
    }
    if (invalidated) vite.ws.send({ type: "full-reload" });
  };
  for (const event of WATCH_EVENTS) vite.watcher.on(event, invalidate);
}

export function appModuleHook(context: RexHookContext): Plugin {
  return {
    name: "rex:app",
    enforce: "pre",
    resolveId(id) {
      return id === APP_MODULE_ID ? RESOLVED_APP_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_APP_MODULE_ID) return null;
      const { root, name } = context.state;
      const core = await resolveRuntimeEntry(this, root, CORE_SPECIFIER, context.paths.core);
      try {
        return generateAppModule(scanApp(root, context.appDir), { name, core });
      } catch (error) {
        if (error instanceof RexAppScanError) this.error(error.message);
        throw error;
      }
    },
    configureServer(vite) {
      watchApp(vite, context.appPath());
    },
  };
}
