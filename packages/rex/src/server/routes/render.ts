import type { Hono } from "hono";
import type { RexServerSetup } from "../app.ts";
import {
  DENSITY_HEADER,
  RexDensityError,
  createRexContext,
  type RexRequestContext,
} from "../context.ts";

export const RENDER_STATUS = Object.freeze({
  page: 200,
  denied: 403,
  "not-found": 404,
  failed: 500,
} as const);

export type RenderKind = keyof typeof RENDER_STATUS;

export const RENDER_PAGE_HEADER = "x-rex-page";
export const RENDER_KIND_HEADER = "x-rex-render";
export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";

export interface RexRenderResult {
  readonly kind: RenderKind;
  readonly page: string | null;
  readonly body: ReadableStream<Uint8Array>;
}

export interface RexPageRenderer {
  render(request: Request, context: RexRequestContext): Promise<RexRenderResult>;
}

const renderers = new WeakMap<object, RexPageRenderer>();

export function registerPageRenderer(registry: object, renderer: RexPageRenderer): () => void {
  if (typeof registry !== "object" || registry === null) {
    throw new TypeError("registerPageRenderer: registry must be the app registry object");
  }
  if (typeof renderer !== "object" || renderer === null || typeof renderer.render !== "function") {
    throw new TypeError("registerPageRenderer: renderer must have a render(request, context) method");
  }
  renderers.set(registry, renderer);
  return () => {
    if (renderers.get(registry) === renderer) renderers.delete(registry);
  };
}

export function pageRendererFor(registry: object): RexPageRenderer | undefined {
  return renderers.get(registry);
}

export const REX_PATH_PREFIX = "/rex";

export function isDocumentPath(path: string): boolean {
  if (path === REX_PATH_PREFIX || path.startsWith(`${REX_PATH_PREFIX}/`)) return false;
  const last = path.split("/").at(-1) ?? "";
  return !last.includes(".");
}

export function installRenderRoute(app: Hono, setup: RexServerSetup): void {
  app.get("*", async (c, next) => {
    const renderer = pageRendererFor(setup.options.registry);
    if (renderer === undefined || !isDocumentPath(c.req.path)) {
      await next();
      return;
    }
    let context: RexRequestContext;
    try {
      context = await createRexContext(c.req.raw, setup.options.actor);
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    const result = await renderer.render(c.req.raw, context);
    const headers = new Headers({
      "content-type": HTML_CONTENT_TYPE,
      "cache-control": "no-store",
      [RENDER_KIND_HEADER]: result.kind,
      [DENSITY_HEADER]: context.density,
    });
    if (result.page !== null) headers.set(RENDER_PAGE_HEADER, result.page);
    return new Response(result.body, { status: RENDER_STATUS[result.kind], headers });
  });
}
