import { relative } from "node:path";
import { normalizePath, type DevEnvironment, type Plugin, type ViteDevServer } from "vite";
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
import { pageChunkGroups, pageChunkName } from "./split.ts";
import { APP_MODULE_ID, CORE_SPECIFIER, RESOLVED_APP_MODULE_ID } from "./virtual.ts";

export interface RexLoadedPageModules {
  readonly view: unknown;
  readonly states: Readonly<Record<string, unknown>>;
  readonly regions: Readonly<Record<string, unknown>>;
  readonly overlays: Readonly<Record<string, unknown>>;
}

export interface RexPageModule {
  readonly id: string;
  readonly page: AnyPage;
  readonly chunk: string;
  load(): Promise<RexLoadedPageModules>;
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
  throw new RexError("REX462", "rex:app: " + file + " " + problem);
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
function rexPage(id, namespace, file, chunk, importModules) {
  const declared = rexDeclarations(namespace, "page", file);
  if (declared.length !== 1) {
    rexFail(file, "must export exactly one page declaration, found " + declared.length);
  }
  const page = declared[0];
  if (page.id !== id) {
    rexFail(file, "declares page " + JSON.stringify(page.id) + " but its folder is " + JSON.stringify(id));
  }
  let loading = null;
  const load = () => {
    if (loading === null) {
      loading = importModules().then((loaded) =>
        Object.freeze({
          view: loaded.view,
          states: Object.freeze({ ...loaded.states }),
          regions: Object.freeze(loaded.regions),
          overlays: Object.freeze(loaded.overlays),
        }),
      );
      loading.catch(() => {
        loading = null;
      });
    }
    return loading;
  };
  return Object.freeze({ id, page, chunk, load });
}`;

export function generateAppModule(scan: AppScan, options: AppModuleOptions): string {
  const literal = (value: string) => JSON.stringify(value);
  const display = (file: string) => literal(normalizePath(relative(scan.root, file)));
  const imports: string[] = [
    `import { RexError, buildManifest, createRegistry } from ${literal(options.core)};`,
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
    const files = [
      scanned.view,
      scanned.states,
      ...scanned.regions.map((region) => region.file),
      ...scanned.overlays.map((overlay) => overlay.file),
    ];
    const bindings = files.map((_file, fileIndex) => `${base}m${fileIndex}`);
    const dynamic = files.map((file) => `import(${literal(file)})`).join(", ");
    const regions = scanned.regions.map(
      (region, regionIndex) =>
        `${literal(region.name)}: rexDefault(${bindings[2 + regionIndex]}, ${display(region.file)})`,
    );
    const overlays = scanned.overlays.map(
      (overlay, overlayIndex) =>
        `${literal(overlay.name)}: rexDefault(${bindings[2 + scanned.regions.length + overlayIndex]}, ${display(overlay.file)})`,
    );
    const loader = [
      `() => Promise.all([${dynamic}]).then(([${bindings.join(", ")}]) => ({`,
      `    view: rexDefault(${bindings[0]}, ${display(scanned.view)}),`,
      `    states: ${bindings[1]},`,
      `    regions: { ${regions.join(", ")} },`,
      `    overlays: { ${overlays.join(", ")} },`,
      "  }))",
    ].join("\n");
    return `rexPage(${literal(scanned.id)}, ${base}, ${display(scanned.page)}, ${literal(pageChunkName(scanned.id))}, ${loader})`;
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

export function invalidateAppModule(
  environment: Pick<DevEnvironment, "moduleGraph">,
  hmrTimestamp?: number,
): boolean {
  const graph = environment.moduleGraph;
  const node = graph.getModuleById(RESOLVED_APP_MODULE_ID);
  if (node === undefined) return false;
  if (hmrTimestamp === undefined) graph.invalidateModule(node);
  else graph.invalidateModule(node, new Set(), hmrTimestamp, true);
  return true;
}

const WATCH_EVENTS = ["add", "unlink", "addDir", "unlinkDir"] as const;

export function watchApp(vite: ViteDevServer, appPath: string): void {
  const prefix = `${normalizePath(appPath)}/`;
  const invalidate = (file: string) => {
    const normalized = normalizePath(file);
    if (normalized !== prefix.slice(0, -1) && !normalized.startsWith(prefix)) return;
    let invalidated = false;
    for (const environment of Object.values(vite.environments)) {
      if (invalidateAppModule(environment)) invalidated = true;
    }
    if (invalidated) vite.ws.send({ type: "full-reload" });
  };
  for (const event of WATCH_EVENTS) vite.watcher.on(event, invalidate);
}

export function appModuleHook(context: RexHookContext): Plugin {
  let serverBuild = false;
  return {
    name: "rex:app",
    enforce: "pre",
    configResolved(config) {
      serverBuild = Boolean(config.build.ssr);
    },
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
    outputOptions(options) {
      if (options.codeSplitting !== undefined && options.codeSplitting !== true) return null;
      if (serverBuild) return { ...options, codeSplitting: false };
      return { ...options, codeSplitting: { groups: pageChunkGroups(context.appPath()) } };
    },
    configureServer(vite) {
      watchApp(vite, context.appPath());
    },
  };
}
