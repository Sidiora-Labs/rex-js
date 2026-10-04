import { getRequestListener } from "@hono/node-server";
import type { Plugin, ViteDevServer } from "vite";
import type { RexHookContext } from "./hooks.ts";

export const API_PREFIX = "/rex";
export const DENSITY_HEADER = "x-rex-density";
export const DENSITY_QUERY = "density";
export const DENSITY_VALUES = ["default", "agent"] as const;

export interface RexFetchApp {
  fetch(request: Request): Response | Promise<Response>;
}

export type RexServerSource =
  RexFetchApp | ((vite: ViteDevServer) => RexFetchApp | Promise<RexFetchApp>);

export function isApiPath(url: string | undefined): boolean {
  if (url === undefined) return false;
  return url === API_PREFIX || url.startsWith(`${API_PREFIX}/`) || url.startsWith(`${API_PREFIX}?`);
}

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

export function mountServer(vite: ViteDevServer, source: RexServerSource): void {
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

export function devServerHook(context: RexHookContext): Plugin {
  return {
    name: "rex:dev-server",
    enforce: "pre",
    configureServer(vite) {
      const source = context.options.server;
      if (source !== undefined) mountServer(vite, source);
    },
  };
}
