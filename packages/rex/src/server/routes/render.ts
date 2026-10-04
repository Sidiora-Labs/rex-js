import type { Hono } from "hono";
import { i18nFor } from "../../client/i18n/context.ts";
import { RexError } from "../../core/errors.ts";
import { STATIC_HEADER, staticCacheFor, type StaticHit } from "../adapters/static-cache.ts";
import type { RexServerSetup } from "../app.ts";
import {
  DENSITY_HEADER,
  RexDensityError,
  createRexContext,
  type RexRequestContext,
} from "../context.ts";
import { bindCsrfGrant, clearOutcomeCookie, ensureCsrfToken, readFormOutcome } from "../form.ts";
import { loaderRunnerFor, withLoaderRunner } from "../loaders.ts";

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
    throw new RexError("REX400", "registerPageRenderer: registry must be the app registry object");
  }
  if (typeof renderer !== "object" || renderer === null || typeof renderer.render !== "function") {
    throw new RexError(
      "REX400",
      "registerPageRenderer: renderer must have a render(request, context) method",
    );
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

function staticResponse(hit: StaticHit, density: string): Response {
  const headers = new Headers({
    "content-type": HTML_CONTENT_TYPE,
    "cache-control": "no-store",
    [RENDER_KIND_HEADER]: "page",
    [RENDER_PAGE_HEADER]: hit.page,
    [STATIC_HEADER]: hit.status,
    [DENSITY_HEADER]: density,
  });
  if (hit.setCookie !== null) headers.append("set-cookie", hit.setCookie);
  return new Response(hit.html, { status: RENDER_STATUS.page, headers });
}

export function installRenderRoute(app: Hono, setup: RexServerSetup): void {
  app.get("*", async (c, next) => {
    const renderer = pageRendererFor(setup.options.registry);
    const cache = staticCacheFor(setup.options.registry);
    const cached = cache !== undefined && cache.has(c.req.path);
    if ((renderer === undefined && !cached) || !isDocumentPath(c.req.path)) {
      await next();
      return;
    }
    let context: RexRequestContext;
    try {
      context = await createRexContext(
        c.req.raw,
        setup.options.actor,
        i18nFor(setup.options.registry)?.settings ?? null,
      );
    } catch (error) {
      if (error instanceof RexDensityError) {
        return c.json({ code: "BAD_REQUEST", message: error.message }, 400);
      }
      throw error;
    }
    if (cached) {
      const runner = loaderRunnerFor(c.req.raw);
      const regenerator =
        renderer === undefined || runner === undefined
          ? renderer
          : withLoaderRunner(renderer, runner);
      const hit = await cache.serve(c.req.raw, regenerator, context);
      if (hit !== null) return staticResponse(hit, context.density);
    }
    if (renderer === undefined) {
      await next();
      return;
    }
    const csrf = ensureCsrfToken(c.req.raw);
    bindCsrfGrant(c.req.raw, csrf);
    const result = await renderer.render(c.req.raw, context);
    const headers = new Headers({
      "content-type": HTML_CONTENT_TYPE,
      "cache-control": "no-store",
      [RENDER_KIND_HEADER]: result.kind,
      [DENSITY_HEADER]: context.density,
    });
    if (result.page !== null) headers.set(RENDER_PAGE_HEADER, result.page);
    if (csrf.setCookie !== null) headers.append("set-cookie", csrf.setCookie);
    if (readFormOutcome(c.req.raw) !== null) {
      headers.append("set-cookie", clearOutcomeCookie(c.req.raw));
    }
    return new Response(result.body, { status: RENDER_STATUS[result.kind], headers });
  });
}
