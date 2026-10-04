import { QueryClient, dehydrate } from "@tanstack/react-query";
import { StrictMode, createElement, type ComponentType, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { Router } from "wouter";
import { createRexEntry, type RexEntryBundle } from "../client/entry.tsx";
import {
  CLIENT_RENDER_DIGEST,
  REX_DATA_ELEMENT_ID,
  REX_DATA_MIME_TYPE,
  REX_DATA_VERSION,
  SSR_ATTRIBUTE,
  serializeRexData,
  type RexDataPayload,
} from "../client/hydrate.ts";
import {
  DefaultState,
  definePageModules,
  isLazyPageModules,
  usePageRuntime,
  type EagerPageModuleSet,
  type LoadedPageModules,
  type PageModuleSet,
  type StateExportComponent,
} from "../client/page.tsx";
import { CsrfTokenContext } from "../client/form.tsx";
import { densityFromSearch, isDensityPreference } from "../client/agent/density.ts";
import { LocaleSeedContext, i18nFor, type I18nSource } from "../client/i18n/context.ts";
import { stripLocalePrefix } from "../client/i18n/locale.ts";
import { translate } from "../client/i18n/messages.ts";
import { shouldDehydrateRexQuery } from "../client/loaders.ts";
import {
  MediaProvider,
  createMediaCollector,
  type PriorityImage,
  type RexMediaCollector,
} from "../client/media.tsx";
import { manifestParamsSchema, orderPages, resolvePage, type PageResolution } from "../client/router.tsx";
import {
  DEFAULT_SCREEN,
  ScreenSeedContext,
  classifyPointer,
  classifyScreen,
  screenAttributes,
  screenDensity,
  type RexScreen,
  type ScreenState,
} from "../client/screen.ts";
import { NOT_FOUND_TITLE } from "../client/shell.tsx";
import { resolveOptions, type FontSpec, type ResolvedFont } from "../core/config.ts";
import { RexError } from "../core/errors.ts";
import { parseRoute, type AnyPage, type PageRender, type PageStatesModule } from "../core/page.ts";
import { STATE_EXPORT_NAMES } from "../core/states.ts";
import type { Manifest } from "../manifest/types.ts";
import { CLIENT_HINT_HEADERS } from "./adapters/client-hints.ts";
import type { RexRequestContext } from "./context.ts";
import { csrfGrantFor } from "./form.ts";
import type { Ledger } from "./audit.ts";
import { createActionLoaderRunner, loaderRunnerFor, runPageLoaders } from "./loaders.ts";
import { resolveRequestLocale } from "./locale.ts";
import type { RenderKind, RexPageRenderer, RexRenderResult } from "./routes/render.ts";

export { registerPageRenderer } from "./routes/render.ts";

export const DEFAULT_ROOT_ELEMENT = "root";
export const DEFAULT_DOCUMENT_LANG = "en";
export const RENDER_FAILURE_MESSAGE = "The page failed to render on the server";
export const INLINE_BOUNDARY_BYTES = Number.POSITIVE_INFINITY;

export interface RexPageAssets {
  readonly stylesheets: readonly string[];
  readonly preloads: readonly string[];
}

export interface RexDocumentAssets extends RexPageAssets {
  readonly scripts: readonly string[];
  readonly head?: string;
  readonly pages: Readonly<Record<string, RexPageAssets>>;
}

export const EMPTY_DOCUMENT_ASSETS: RexDocumentAssets = Object.freeze({
  scripts: Object.freeze([]),
  stylesheets: Object.freeze([]),
  preloads: Object.freeze([]),
  pages: Object.freeze({}),
});

export interface RexRendererOptions {
  readonly bundle: RexEntryBundle;
  readonly assets?: RexDocumentAssets;
  readonly rootElement?: string;
  readonly lang?: string;
  readonly fonts?: readonly FontSpec[];
  readonly ledger?: Ledger;
}

type ResolvedRendererOptions = Required<Omit<RexRendererOptions, "bundle" | "fonts" | "ledger">> & {
  readonly fonts: readonly ResolvedFont[];
};

export interface PageMatch {
  readonly page: AnyPage;
  readonly routeParams: Readonly<Record<string, string>>;
}

export class RexClientRenderSignal extends Error {
  readonly page: string;

  constructor(page: string) {
    super(`page "${page}" renders on the client (render: csr)`);
    this.name = "RexClientRenderSignal";
    this.page = page;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const routePatterns = new Map<string, { readonly pattern: RegExp; readonly params: readonly string[] }>();

function routePattern(route: string) {
  let compiled = routePatterns.get(route);
  if (compiled === undefined) {
    const parsed = parseRoute(route);
    const body = parsed.segments
      .map((segment) =>
        segment.kind === "static" ? `/${escapeRegExp(segment.value)}` : "/([^/]+?)",
      )
      .join("");
    compiled = { pattern: new RegExp(`^${body}/?$`, "i"), params: parsed.params };
    routePatterns.set(route, compiled);
  }
  return compiled;
}

export function matchPage(pages: readonly AnyPage[], pathname: string): PageMatch | null {
  for (const declared of orderPages(pages)) {
    const { pattern, params } = routePattern(declared.route);
    const found = pattern.exec(pathname);
    if (found === null) continue;
    const routeParams: Record<string, string> = {};
    params.forEach((name, index) => {
      routeParams[name] = found[index + 1] as string;
    });
    return { page: declared, routeParams: Object.freeze(routeParams) };
  }
  return null;
}

const MOBILE_AGENT = /Mobi|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini/i;
const TABLET_AGENT = /iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobi)/i;

function mobileHint(value: string | null): boolean | null {
  const hint = value?.trim();
  if (hint === "?1") return true;
  if (hint === "?0") return false;
  return null;
}

function viewportHint(value: string | null): number | null {
  if (value === null || !/^\s*\d+(?:\.\d+)?\s*$/.test(value)) return null;
  const width = Number.parseFloat(value);
  return width > 0 ? width : null;
}

export function screenFromRequest(request: Request, context: RexRequestContext): ScreenState {
  const headers = request.headers;
  const agent = headers.get(CLIENT_HINT_HEADERS.userAgent) ?? "";
  const tablet = TABLET_AGENT.test(agent);
  const mobile =
    mobileHint(headers.get(CLIENT_HINT_HEADERS.mobile)) ?? (!tablet && MOBILE_AGENT.test(agent));
  const width = viewportHint(headers.get(CLIENT_HINT_HEADERS.viewportWidth));
  let screen: RexScreen = DEFAULT_SCREEN;
  if (width !== null) screen = classifyScreen(width);
  else if (mobile) screen = "phone";
  else if (tablet) screen = "tablet";
  const query = densityFromSearch(new URL(request.url).search);
  return Object.freeze({
    screen,
    pointer: classifyPointer(mobile || tablet),
    density: screenDensity(isDensityPreference(query) ? query : context.density),
  });
}

export function pageRenderMode(manifest: Manifest, declared: AnyPage): PageRender {
  const listed = manifest.pages.find((entry) => entry.id === declared.id);
  return listed?.render ?? declared.render ?? "ssr";
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] as string);
}

const INLINE_SCRIPT = /<script(?![^>]*\bnonce=)(?![^>]*\bsrc=)([^>]*)>/gi;

export function nonceInlineScripts(html: string, nonce: string): string {
  return html.replace(INLINE_SCRIPT, (_tag, attributes: string) => {
    return `<script${attributes} nonce="${escapeHtml(nonce)}">`;
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

const FONT_FORMATS: Readonly<Record<string, { readonly type: string; readonly format: string }>> = {
  woff2: { type: "font/woff2", format: "woff2" },
  woff: { type: "font/woff", format: "woff" },
  ttf: { type: "font/ttf", format: "truetype" },
  otf: { type: "font/otf", format: "opentype" },
};

function fontFormat(src: string) {
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(src)?.[1]?.toLowerCase();
  return extension === undefined ? undefined : FONT_FORMATS[extension];
}

function cssString(value: string): string {
  const escaped = value.replace(/[\\"<>\n\r]/g, (character) => {
    if (character === "\\" || character === '"') return `\\${character}`;
    return `\\${character.charCodeAt(0).toString(16)} `;
  });
  return `"${escaped}"`;
}

export function fontPreloadLinks(fonts: readonly ResolvedFont[]): string[] {
  return fonts
    .filter((font) => font.preload)
    .map((font) => {
      const type = fontFormat(font.src)?.type;
      const typed = type === undefined ? "" : ` type="${type}"`;
      return `<link rel="preload" as="font" href="${escapeHtml(font.src)}"${typed} crossorigin="">`;
    });
}

export function fontFaceCss(fonts: readonly ResolvedFont[]): string {
  return fonts
    .map((font) => {
      const format = fontFormat(font.src)?.format;
      const source = `url(${cssString(font.src)})${format === undefined ? "" : ` format("${format}")`}`;
      const weight = font.weight === null ? "" : `font-weight:${font.weight};`;
      return `@font-face{font-family:${cssString(font.family)};src:${source};${weight}font-style:${font.style};font-display:swap}`;
    })
    .join("");
}

export function imagePreloadLinks(images: readonly PriorityImage[]): string[] {
  return images.map((image) => {
    const srcSet = image.srcSet === null ? "" : ` imagesrcset="${escapeHtml(image.srcSet)}"`;
    const sizes = image.sizes === null ? "" : ` imagesizes="${escapeHtml(image.sizes)}"`;
    return `<link rel="preload" as="image" href="${escapeHtml(image.src)}"${srcSet}${sizes} fetchpriority="high">`;
  });
}

export function pageAssets(assets: RexDocumentAssets, page: string | null): RexPageAssets {
  const own = page === null ? undefined : assets.pages[page];
  return {
    stylesheets: unique([...assets.stylesheets, ...(own?.stylesheets ?? [])]),
    preloads: unique([...assets.preloads, ...(own?.preloads ?? [])]),
  };
}

interface DocumentParts {
  readonly lang: string;
  readonly title: string;
  readonly nonce: string;
  readonly links: RexPageAssets;
  readonly data: RexDataPayload;
  readonly hydrate: boolean;
  readonly images: readonly PriorityImage[];
  readonly screen: ScreenState;
}

function documentHead(options: ResolvedRendererOptions, parts: DocumentParts): string {
  const nonce = escapeHtml(parts.nonce);
  const stylesheets = parts.links.stylesheets.map(
    (href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`,
  );
  const preloads = parts.links.preloads.map(
    (href) => `<link rel="modulepreload" href="${escapeHtml(href)}">`,
  );
  const root = parts.hydrate
    ? `<div id="${escapeHtml(options.rootElement)}" ${SSR_ATTRIBUTE}="">`
    : `<div id="${escapeHtml(options.rootElement)}">`;
  return [
    "<!doctype html>",
    `<html lang="${escapeHtml(parts.lang)}"${Object.entries(screenAttributes(parts.screen))
      .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
      .join("")}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(parts.title)}</title>`,
    ...fontPreloadLinks(options.fonts),
    ...imagePreloadLinks(parts.images),
    options.fonts.length === 0 ? "" : `<style data-rex-fonts="">${fontFaceCss(options.fonts)}</style>`,
    ...stylesheets,
    ...preloads,
    options.assets.head === undefined ? "" : nonceInlineScripts(options.assets.head, parts.nonce),
    `<script type="${REX_DATA_MIME_TYPE}" id="${REX_DATA_ELEMENT_ID}" nonce="${nonce}">${serializeRexData(parts.data)}</script>`,
    "</head>",
    "<body>",
    root,
  ].join("");
}

function documentTail(options: ResolvedRendererOptions, nonce: string): string {
  const scripts = options.assets.scripts.map(
    (src) => `<script type="module" src="${escapeHtml(src)}" nonce="${escapeHtml(nonce)}"></script>`,
  );
  return ["</div>", ...scripts, "</body>", "</html>"].join("");
}

export function documentStream(
  head: string,
  body: ReadableStream<Uint8Array>,
  tail: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(head));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode(tail));
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function actorData(context: RexRequestContext): RexDataPayload["actor"] {
  const { id, roles, permissions, attributes } = context.actor;
  return { id, roles, permissions, attributes };
}

function clientRenderedModules(declared: AnyPage): PageModuleSet {
  const signal = new RexClientRenderSignal(declared.id);
  const rejected = Promise.reject(signal);
  rejected.catch(() => {});
  return Object.freeze({ page: declared, load: () => rejected });
}

function failedView(declared: AnyPage, states: Readonly<Record<string, unknown>>): ComponentType {
  const name = STATE_EXPORT_NAMES["recoverable-error"];
  const Export = declared.states.includes("recoverable-error")
    ? (states[name] as StateExportComponent | undefined)
    : undefined;
  const error = new Error(RENDER_FAILURE_MESSAGE);
  const retry = () => {
    globalThis.location?.reload();
  };
  function RexRenderFailure() {
    const runtime = usePageRuntime();
    return Export === undefined
      ? createElement(DefaultState, {
          state: "recoverable-error",
          params: runtime.params,
          retry,
          error,
        })
      : createElement(Export, { params: runtime.params, retry, error });
  }
  RexRenderFailure.displayName = `RexRenderFailure(${declared.id})`;
  return RexRenderFailure;
}

async function loadedModules(set: PageModuleSet): Promise<LoadedPageModules> {
  return isLazyPageModules(set) ? set.load() : set;
}

export function requestLocale(
  source: I18nSource | null,
  request: Request,
  context: RexRequestContext,
): string | null {
  if (source === null) return null;
  const known = context.locale;
  if (known !== undefined && source.settings.locales.includes(known)) return known;
  return resolveRequestLocale(request, source.settings).locale;
}

export function routedPathname(source: I18nSource | null, pathname: string): string {
  if (source === null || source.settings.routing !== "prefix") return pathname;
  return stripLocalePrefix(pathname, source.settings.locales);
}

export function createRexRenderer(options: RexRendererOptions): RexPageRenderer {
  const bundle = options.bundle;
  if (typeof bundle !== "object" || bundle === null || !Array.isArray(bundle.pages)) {
    throw new RexError("REX313", "createRexRenderer: the rex:app bundle with registry and pages is required");
  }
  if (bundle.manifest === undefined) {
    throw new RexError("REX400", "createRexRenderer: the bundle must carry its manifest");
  }
  const manifest: Manifest = bundle.manifest;
  const resolved: ResolvedRendererOptions = {
    assets: options.assets ?? EMPTY_DOCUMENT_ASSETS,
    rootElement: options.rootElement ?? DEFAULT_ROOT_ELEMENT,
    lang: options.lang ?? DEFAULT_DOCUMENT_LANG,
    fonts: resolveOptions({ fonts: options.fonts ?? [] }).fonts,
  };
  const registry = bundle.registry;
  const ownRunner =
    options.ledger === undefined
      ? undefined
      : createActionLoaderRunner(registry, { ledger: options.ledger });
  const sets = new Map<string, PageModuleSet>();
  for (const set of bundle.pages) sets.set(set.page.id, set);
  const serverPages = bundle.pages.map((set) =>
    pageRenderMode(manifest, set.page) === "csr" ? clientRenderedModules(set.page) : set,
  );

  function entryTree(
    url: URL,
    context: RexRequestContext,
    pages: readonly PageModuleSet[],
    queryClient: QueryClient,
    locale: string | null,
    media: RexMediaCollector,
    csrf: string | null,
    screen: ScreenState,
  ): ReactNode {
    const RexEntry = createRexEntry(
      { registry, manifest, pages },
      { actor: context.actor, baseUrl: url.origin, queryClient },
    );
    const app = createElement(
      ScreenSeedContext.Provider,
      { value: screen },
      createElement(MediaProvider, { value: media }, createElement(RexEntry)),
    );
    const entry = createElement(
      StrictMode,
      null,
      csrf === null ? app : createElement(CsrfTokenContext.Provider, { value: csrf }, app),
    );
    return createElement(Router, {
      ssrPath: url.pathname,
      ssrSearch: url.search.replace(/^\?/, ""),
      children:
        locale === null
          ? entry
          : createElement(LocaleSeedContext.Provider, { value: locale }, entry),
    });
  }

  function parts(
    match: PageMatch | null,
    context: RexRequestContext,
    queryClient: QueryClient,
    hydrate: boolean,
    locale: string | null,
    screen: ScreenState,
    images: readonly PriorityImage[] = [],
  ): DocumentParts {
    const page = match === null ? null : match.page.id;
    const source = i18nFor(registry);
    const title = match === null ? NOT_FOUND_TITLE : match.page.chrome.title;
    return {
      lang: locale ?? resolved.lang,
      title: locale === null ? title : translate(source, locale, title),
      nonce: context.nonce,
      links: pageAssets(resolved.assets, page),
      data: {
        version: REX_DATA_VERSION,
        page,
        actor: actorData(context),
        queries: dehydrate(queryClient, { shouldDehydrateQuery: shouldDehydrateRexQuery }),
      },
      hydrate,
      images,
      screen,
    };
  }

  async function staticFailure(
    match: PageMatch | null,
    context: RexRequestContext,
  ): Promise<ReadableStream<Uint8Array>> {
    const error = new Error(RENDER_FAILURE_MESSAGE);
    const stream = await renderToReadableStream(
      createElement(
        "main",
        { "data-rex-page": match?.page.id, "data-rex-app-state": "error" },
        createElement(DefaultState, {
          state: "recoverable-error",
          params: {},
          retry: () => {},
          error,
        }),
      ),
      { nonce: context.nonce },
    );
    await stream.allReady;
    return stream;
  }

  async function failure(
    url: URL,
    match: PageMatch | null,
    context: RexRequestContext,
    locale: string | null,
    csrf: string | null,
    screen: ScreenState,
  ): Promise<RexRenderResult> {
    const queryClient = new QueryClient();
    const head = documentHead(resolved, parts(match, context, queryClient, false, locale, screen));
    const tail = documentTail(resolved, context.nonce);
    let body: ReadableStream<Uint8Array> | null = null;
    if (match !== null) {
      try {
        const set = sets.get(match.page.id) as PageModuleSet;
        const loaded = await loadedModules(set);
        const states = loaded.states as Readonly<Record<string, unknown>>;
        const eager: EagerPageModuleSet = definePageModules({
          page: match.page,
          view: failedView(match.page, states),
          states: states as PageStatesModule<AnyPage>,
          regions: (loaded.regions ?? {}) as Readonly<Record<string, ComponentType>>,
          overlays: (loaded.overlays ?? {}) as Readonly<Record<string, ComponentType>>,
        });
        const pages = bundle.pages.map((entry) => (entry.page === match.page ? eager : entry));
        const media = createMediaCollector(context.nonce);
        const stream = await renderToReadableStream(
          entryTree(url, context, pages, queryClient, locale, media.collector, csrf, screen),
          {
            nonce: context.nonce,
            progressiveChunkSize: INLINE_BOUNDARY_BYTES,
          },
        );
        await stream.allReady;
        body = stream;
      } catch {
        body = null;
      }
    }
    return {
      kind: "failed",
      page: match === null ? null : match.page.id,
      body: documentStream(head, body ?? (await staticFailure(match, context)), tail),
    };
  }

  async function loadPageData(
    request: Request,
    resolution: PageResolution,
    context: RexRequestContext,
    queryClient: QueryClient,
  ): Promise<boolean> {
    const declared = resolution.page;
    if (declared.loaders.length === 0) return true;
    if (!resolution.policy.allowed || resolution.issues.length > 0) return true;
    const runner = loaderRunnerFor(request) ?? ownRunner;
    if (runner === undefined) {
      throw new RexError(
        "REX408",
        `rex: page "${declared.id}" declares loaders but the request was not served by createRexServer`,
      );
    }
    const outcomes = await runPageLoaders({
      page: declared,
      params: resolution.params,
      context,
      queryClient,
      runner,
    });
    return outcomes.every((outcome) => outcome.ok);
  }

  async function render(request: Request, context: RexRequestContext): Promise<RexRenderResult> {
    const url = new URL(request.url);
    const source = i18nFor(registry);
    const locale = requestLocale(source, request, context);
    const match = matchPage(registry.pages, routedPathname(source, url.pathname));
    const csrf = csrfGrantFor(request)?.token ?? null;
    const screen = screenFromRequest(request, context);
    const queryClient = new QueryClient();
    let kind: RenderKind = "not-found";
    if (match !== null) {
      const resolution = resolvePage(
        match.page,
        match.routeParams,
        url.search,
        context.actor,
        registry,
        manifestParamsSchema(manifest, match.page),
      );
      kind = resolution.policy.allowed ? "page" : "denied";
      if (pageRenderMode(manifest, match.page) !== "csr") {
        try {
          await loadedModules(sets.get(match.page.id) as PageModuleSet);
        } catch {
          return failure(url, match, context, locale, csrf, screen);
        }
        if (!(await loadPageData(request, resolution, context, queryClient))) kind = "failed";
      }
    }
    const media = createMediaCollector(context.nonce);
    const errors: unknown[] = [];
    let stream: Awaited<ReturnType<typeof renderToReadableStream>>;
    try {
      stream = await renderToReadableStream(entryTree(url, context, serverPages, queryClient, locale, media.collector, csrf, screen), {
        nonce: context.nonce,
        progressiveChunkSize: INLINE_BOUNDARY_BYTES,
        onError(error) {
          if (error instanceof RexClientRenderSignal) return CLIENT_RENDER_DIGEST;
          errors.push(error);
          return undefined;
        },
      });
    } catch {
      return failure(url, match, context, locale, csrf, screen);
    }
    await stream.allReady.catch(() => {});
    if (errors.length > 0) {
      await stream.cancel();
      return failure(url, match, context, locale, csrf, screen);
    }
    return {
      kind,
      page: match === null ? null : match.page.id,
      body: documentStream(
        documentHead(resolved, parts(match, context, queryClient, true, locale, screen, media.images())),
        stream,
        documentTail(resolved, context.nonce),
      ),
    };
  }

  return { render };
}
