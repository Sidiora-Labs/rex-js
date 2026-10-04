import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";
import type { RexDocumentAssets } from "../server/ssr.ts";
import { forwardDensity, isApiPath, type RexServerSource } from "./dev-server.ts";
import type { RexHookContext } from "./hooks.ts";
import { APP_MODULE_ID, ENTRY_MODULE_ID, ROOT_ELEMENT_ID } from "./virtual.ts";

export const RENDER_MODULE_ID = "rex:render";
export const RESOLVED_RENDER_MODULE_ID = "\0rex:render";
export const DEV_DOCUMENT_TEMPLATE =
  '<!doctype html><html><head></head><body><div id="root"></div></body></html>';

export function ssrRuntimePath(from: string = import.meta.url): string {
  const extension = from.endsWith(".ts") ? ".ts" : ".js";
  return normalizePath(join(dirname(dirname(fileURLToPath(from))), "server", `ssr${extension}`));
}

export interface RenderModuleOptions {
  readonly ssr: string;
  readonly assets: RexDocumentAssets;
  readonly rootElement?: string;
}

export function generateRenderModule(options: RenderModuleOptions): string {
  const rootElement = options.rootElement ?? ROOT_ELEMENT_ID;
  return [
    `import { createRexRenderer, registerPageRenderer } from ${JSON.stringify(options.ssr)};`,
    `import app, { config } from ${JSON.stringify(APP_MODULE_ID)};`,
    "",
    `export const assets = ${JSON.stringify(options.assets)};`,
    `export const renderer = createRexRenderer({ bundle: app, assets, rootElement: ${JSON.stringify(rootElement)}, fonts: config.fonts });`,
    "registerPageRenderer(app.registry, renderer);",
    "export default renderer;",
    "",
  ].join("\n");
}

export type RenderAssetsSource = () => RexDocumentAssets | Promise<RexDocumentAssets>;

export function renderModulePlugin(assets: RenderAssetsSource, ssr: string = ssrRuntimePath()): Plugin {
  return {
    name: "rex:render",
    enforce: "pre",
    resolveId(id) {
      return id === RENDER_MODULE_ID ? RESOLVED_RENDER_MODULE_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_RENDER_MODULE_ID) return null;
      return generateRenderModule({ ssr, assets: await assets() });
    },
  };
}

export function devHeadHtml(transformed: string): string {
  const open = /<head[^>]*>/i.exec(transformed);
  const close = transformed.search(/<\/head>/i);
  if (open === null || close < 0) return "";
  return transformed.slice(open.index + open[0].length, close).trim();
}

export function devAssets(head: string): RexDocumentAssets {
  return Object.freeze({
    scripts: Object.freeze([ENTRY_MODULE_ID]),
    stylesheets: Object.freeze([]),
    preloads: Object.freeze([]),
    pages: Object.freeze({}),
    head,
  });
}

export interface DocumentRequestLike {
  readonly method?: string | undefined;
  readonly url?: string | undefined;
  readonly headers: { readonly accept?: string | undefined };
}

export function isDocumentRequest(request: DocumentRequestLike): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = request.url;
  if (url === undefined || isApiPath(url)) return false;
  const path = url.split("?")[0] ?? url;
  if (path.startsWith("/@") || path.startsWith("/__") || path.startsWith("/node_modules/")) {
    return false;
  }
  const last = path.split("/").at(-1) ?? "";
  if (last.includes(".")) return false;
  return (request.headers.accept ?? "").includes("text/html");
}

export function mountRenderer(vite: ViteDevServer, source: RexServerSource): void {
  const listener = getRequestListener(
    async (request) => {
      await vite.ssrLoadModule(RENDER_MODULE_ID);
      const target = typeof source === "function" ? await source(vite) : source;
      return target.fetch(forwardDensity(request));
    },
    { overrideGlobalObjects: false },
  );
  vite.middlewares.use((req, res, next) => {
    if (!isDocumentRequest(req)) {
      next();
      return;
    }
    listener(req, res).catch(next);
  });
}

export function ssrHook(context: RexHookContext): readonly Plugin[] {
  let server: ViteDevServer | null = null;
  const assets: RenderAssetsSource = async () => {
    if (server === null) return devAssets("");
    return devAssets(devHeadHtml(await server.transformIndexHtml("/", DEV_DOCUMENT_TEMPLATE)));
  };
  return [
    renderModulePlugin(assets),
    {
      name: "rex:ssr",
      enforce: "pre",
      configureServer(vite) {
        server = vite;
        const source = context.options.server;
        if (source !== undefined) mountRenderer(vite, source);
      },
    },
  ];
}
