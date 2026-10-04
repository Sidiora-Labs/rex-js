/// <reference path="./rex-app.d.ts" />
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { getRequestListener } from "@hono/node-server";
import react from "@vitejs/plugin-react";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import { DEFAULT_APP_NAME } from "../manifest/build.ts";
import {
  APP_MODULE_ID,
  DEFAULT_APP_DIR,
  ENTRY_MODULE_ID,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  RexAppScanError,
  generateAppModule,
  generateEntryModule,
  runtimePaths,
  scanApp,
} from "./virtual.ts";

export {
  APP_MODULE_ID,
  DECLARATION_FOLDERS,
  DEFAULT_APP_DIR,
  ENTRY_MODULE_ID,
  PAGE_FILES,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  ROOT_ELEMENT_ID,
  RexAppScanError,
  generateAppModule,
  generateEntryModule,
  runtimePaths,
  scanApp,
} from "./virtual.ts";
export type {
  AppModuleOptions,
  AppScan,
  EntryModuleOptions,
  RexAppBundle,
  RexPageModule,
  RuntimePaths,
  ScannedNamedFile,
  ScannedPage,
} from "./virtual.ts";

export const API_PREFIX = "/rex";
export const DENSITY_HEADER = "x-rex-density";

export interface RexFetchApp {
  fetch(request: Request): Response | Promise<Response>;
}

export type RexServerSource =
  RexFetchApp | ((vite: ViteDevServer) => RexFetchApp | Promise<RexFetchApp>);

export interface RexPluginOptions {
  readonly appDir?: string;
  readonly name?: string;
  readonly server?: RexServerSource;
}

const WATCH_EVENTS = ["add", "unlink", "addDir", "unlinkDir"] as const;

export function isApiPath(url: string | undefined): boolean {
  if (url === undefined) return false;
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`) || url.startsWith(`${API_PREFIX}?`);
}

function packageName(root: string): string | null {
  const file = join(root, "package.json");
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { name?: unknown };
  return typeof parsed.name === "string" && parsed.name.trim() !== "" ? parsed.name : null;
}

export const DENSITY_QUERY = "density";
export const DENSITY_VALUES = ["default", "agent"] as const;

export function forwardDensity(request: Request): Request {
  const fromQuery = new URL(request.url).searchParams.get(DENSITY_QUERY);
  if (fromQuery === null || !(DENSITY_VALUES as readonly string[]).includes(fromQuery)) {
    return request;
  }
  if (request.headers.get(DENSITY_HEADER) === fromQuery) return request;
  const headers = new Headers(request.headers);
  headers.set(DENSITY_HEADER, fromQuery);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    signal: request.signal,
  };
  if (request.body !== null) {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(request.url, init);
}

function mountServer(vite: ViteDevServer, source: RexServerSource): void {
  const listener = getRequestListener(
    async (request) => {
      const target = typeof source === "function" ? await source(vite) : source;
      return target.fetch(forwardDensity(request));
    },
    { overrideGlobalObjects: false },
  );
  vite.middlewares.use((req, res, next) => {
    if (!isApiPath(req.url)) {
      next();
      return;
    }
    listener(req, res).catch(next);
  });
}

function watchApp(vite: ViteDevServer, appPath: string): void {
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

export function rex(options: RexPluginOptions = {}): Plugin[] {
  const appDir = options.appDir ?? DEFAULT_APP_DIR;
  const paths = runtimePaths();
  let root = process.cwd();
  let name = options.name ?? DEFAULT_APP_NAME;

  const plugin: Plugin = {
    name: "rex",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
      name = options.name ?? packageName(root) ?? DEFAULT_APP_NAME;
    },
    resolveId(id) {
      if (id === APP_MODULE_ID) return RESOLVED_APP_MODULE_ID;
      if (id === ENTRY_MODULE_ID) return RESOLVED_ENTRY_MODULE_ID;
      return null;
    },
    load(id) {
      if (id === RESOLVED_APP_MODULE_ID) {
        try {
          return generateAppModule(scanApp(root, appDir), { name, core: paths.core });
        } catch (error) {
          if (error instanceof RexAppScanError) this.error(error.message);
          throw error;
        }
      }
      if (id === RESOLVED_ENTRY_MODULE_ID) {
        return generateEntryModule({ client: paths.client });
      }
      return null;
    },
    configureServer(vite) {
      watchApp(vite, resolve(root, appDir));
      if (options.server !== undefined) mountServer(vite, options.server);
    },
  };

  return [plugin, ...react()];
}

export default rex;
