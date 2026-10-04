import { anonymousActor, type Actor } from "../../core/actor.ts";
import { isPlainObject } from "../../core/entity.ts";
import { DEFAULT_DENSITY, type RexRequestContext } from "../context.ts";
import { CSRF_FIELD, ensureCsrfToken } from "../form.ts";
import type { RexPageRenderer } from "../routes/render.ts";

export const PRERENDER_MODES = ["ssg", "static"] as const;

export type PrerenderMode = (typeof PRERENDER_MODES)[number];

export const PRERENDER_LIST_FILE = "prerender.json";
export const PRERENDER_LIST_VERSION = 1;
export const PRERENDER_INDEX_FILE = "index.html";
export const PRERENDER_NONCE = "rex-prerender-nonce";
export const STATIC_HEADER = "x-rex-static";

export interface StaticPageEntry {
  readonly path: string;
  readonly page: string;
  readonly render: PrerenderMode;
  readonly revalidate: number | null;
  readonly file: string;
  readonly generatedAt: number;
}

export interface PrerenderList {
  readonly version: typeof PRERENDER_LIST_VERSION;
  readonly pages: readonly StaticPageEntry[];
}

export class RexStaticPageError extends Error {
  readonly page: string;
  readonly path: string;

  constructor(page: string, path: string, problem: string) {
    super(`page "${page}" at ${path} ${problem}`);
    this.name = "RexStaticPageError";
    this.page = page;
    this.path = path;
  }
}

export function isPrerenderMode(value: unknown): value is PrerenderMode {
  return typeof value === "string" && (PRERENDER_MODES as readonly string[]).includes(value);
}

export function normalizePagePath(pathname: string): string {
  if (!pathname.startsWith("/")) throw new TypeError(`page path "${pathname}" must start with /`);
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

const UNSAFE_SEGMENT = /[/\\\0]/;

export function prerenderedFile(path: string): string {
  const normalized = normalizePagePath(path);
  if (normalized === "/") return PRERENDER_INDEX_FILE;
  const segments = normalized
    .slice(1)
    .split("/")
    .map((segment) => {
      let decoded: string;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        throw new TypeError(`page path "${path}" has a malformed segment "${segment}"`);
      }
      if (decoded === "" || decoded === "." || decoded === ".." || UNSAFE_SEGMENT.test(decoded)) {
        throw new TypeError(`page path "${path}" has an unsafe segment "${segment}"`);
      }
      return decoded;
    });
  return [...segments, PRERENDER_INDEX_FILE].join("/");
}

function readEntry(value: unknown, index: number): StaticPageEntry {
  const fail = (problem: string): never => {
    throw new TypeError(`${PRERENDER_LIST_FILE}: pages.${index} ${problem}`);
  };
  if (!isPlainObject(value)) return fail("must be an object");
  const { path, page, render, revalidate, file, generatedAt } = value;
  if (typeof path !== "string" || !path.startsWith("/")) fail("path must start with /");
  if (typeof page !== "string" || page === "") fail("page must be a page id");
  if (!isPrerenderMode(render)) fail(`render must be one of ${PRERENDER_MODES.join(", ")}`);
  if (revalidate !== null && (!Number.isInteger(revalidate) || (revalidate as number) <= 0)) {
    fail("revalidate must be null or a positive whole number of seconds");
  }
  if (typeof file !== "string" || file !== prerenderedFile(path as string)) {
    fail(`file must be ${prerenderedFile(path as string)}`);
  }
  if (typeof generatedAt !== "number" || !Number.isFinite(generatedAt)) {
    fail("generatedAt must be a timestamp in milliseconds");
  }
  return Object.freeze({
    path: normalizePagePath(path as string),
    page: page as string,
    render: render as PrerenderMode,
    revalidate: revalidate as number | null,
    file: file as string,
    generatedAt: generatedAt as number,
  });
}

export function parsePrerenderList(value: unknown): PrerenderList {
  if (!isPlainObject(value)) throw new TypeError(`${PRERENDER_LIST_FILE} must be a JSON object`);
  if (value.version !== PRERENDER_LIST_VERSION) {
    throw new TypeError(
      `${PRERENDER_LIST_FILE} version ${JSON.stringify(value.version)} is not ${PRERENDER_LIST_VERSION}`,
    );
  }
  if (!Array.isArray(value.pages)) throw new TypeError(`${PRERENDER_LIST_FILE} pages must be a list`);
  const pages = value.pages.map(readEntry);
  const seen = new Set<string>();
  for (const entry of pages) {
    if (seen.has(entry.path)) throw new TypeError(`${PRERENDER_LIST_FILE} repeats path ${entry.path}`);
    seen.add(entry.path);
  }
  return Object.freeze({ version: PRERENDER_LIST_VERSION, pages: Object.freeze(pages) });
}

export function serializePrerenderList(list: PrerenderList): string {
  return `${JSON.stringify(parsePrerenderList(list), null, 2)}\n`;
}

export function prerenderContext(actor: Actor = anonymousActor): RexRequestContext {
  return Object.freeze({
    actor,
    density: DEFAULT_DENSITY,
    confirm: undefined,
    nonce: PRERENDER_NONCE,
  });
}

export interface RenderedStaticPage {
  readonly page: string;
  readonly html: string;
}

export async function renderPrerenderedHtml(
  renderer: RexPageRenderer,
  url: URL,
  actor: Actor = anonymousActor,
): Promise<RenderedStaticPage> {
  const request = new Request(url, { headers: { accept: "text/html" } });
  const result = await renderer.render(request, prerenderContext(actor));
  const html = await new Response(result.body).text();
  if (result.kind !== "page" || result.page === null) {
    throw new RexStaticPageError(
      result.page ?? "(none)",
      url.pathname,
      `cannot be prerendered: the render ended as ${result.kind}`,
    );
  }
  return { page: result.page, html };
}

const CSRF_INPUT = new RegExp(`<input\\b[^>]*\\bname="${CSRF_FIELD}"[^>]*>`, "g");
const VALUE_ATTRIBUTE = /\svalue="[^"]*"/;

export function hasCsrfField(html: string): boolean {
  CSRF_INPUT.lastIndex = 0;
  return CSRF_INPUT.test(html);
}

export function fillCsrfToken(html: string, token: string): string {
  if (!/^[0-9a-f]+$/.test(token)) throw new TypeError("fillCsrfToken: token must be hexadecimal");
  return html.replace(CSRF_INPUT, (input) =>
    VALUE_ATTRIBUTE.test(input)
      ? input.replace(VALUE_ATTRIBUTE, ` value="${token}"`)
      : input.replace(/\s*\/?>$/, (end) => ` value="${token}"${end.trim()}`),
  );
}

const NONCE_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function fillNonce(html: string, nonce: string): string {
  const escaped = nonce.replace(/[&<>"']/g, (character) => NONCE_ESCAPES[character] as string);
  return html.replaceAll(`nonce="${PRERENDER_NONCE}"`, `nonce="${escaped}"`);
}

export interface StaticPageStore {
  read(path: string): Promise<string | null>;
  write(path: string, html: string): Promise<void>;
}

export function memoryStaticStore(
  initial: Iterable<readonly [string, string]> = [],
): StaticPageStore {
  const pages = new Map<string, string>();
  for (const [path, html] of initial) pages.set(normalizePagePath(path), html);
  return Object.freeze({
    async read(path: string) {
      return pages.get(normalizePagePath(path)) ?? null;
    },
    async write(path: string, html: string) {
      pages.set(normalizePagePath(path), html);
    },
  });
}

export type StaticServeStatus = "hit" | "stale" | "generated";

export interface StaticHit {
  readonly page: string;
  readonly path: string;
  readonly status: StaticServeStatus;
  readonly html: string;
  readonly setCookie: string | null;
}

export type StaticCacheErrorHandler = (error: unknown, entry: StaticPageEntry) => void;

export interface StaticCacheOptions {
  readonly pages: readonly StaticPageEntry[];
  readonly store: StaticPageStore;
  readonly actor?: Actor;
  readonly onError?: StaticCacheErrorHandler;
}

export interface StaticCache {
  readonly size: number;
  has(pathname: string): boolean;
  entry(pathname: string): StaticPageEntry | undefined;
  entries(): readonly StaticPageEntry[];
  serve(request: Request, renderer: RexPageRenderer | undefined, nonce: string): Promise<StaticHit | null>;
  regenerate(pathname: string, origin: string, renderer: RexPageRenderer | undefined): Promise<StaticPageEntry>;
  settled(): Promise<void>;
}

function reportRegenerationFailure(error: unknown, entry: StaticPageEntry): void {
  console.error(`rex: regenerating ${entry.path} (page "${entry.page}") failed; serving the cached page`, error);
}

export function isStale(entry: StaticPageEntry, now: number): boolean {
  return entry.revalidate !== null && now - entry.generatedAt >= entry.revalidate * 1000;
}

export function createStaticCache(options: StaticCacheOptions): StaticCache {
  const { store } = options;
  const actor = options.actor ?? anonymousActor;
  const onError = options.onError ?? reportRegenerationFailure;
  const entries = new Map<string, StaticPageEntry>();
  for (const entry of parsePrerenderList({ version: PRERENDER_LIST_VERSION, pages: options.pages }).pages) {
    entries.set(entry.path, entry);
  }
  const inFlight = new Map<string, Promise<StaticPageEntry>>();

  const lookup = (pathname: string): StaticPageEntry | undefined => {
    if (!pathname.startsWith("/")) return undefined;
    return entries.get(normalizePagePath(pathname));
  };

  async function render(
    entry: StaticPageEntry,
    origin: string,
    renderer: RexPageRenderer | undefined,
  ): Promise<StaticPageEntry> {
    if (entry.render === "static") {
      throw new RexStaticPageError(
        entry.page,
        entry.path,
        "renders static and is only generated by rex build; rebuild the app to change it",
      );
    }
    if (renderer === undefined) {
      throw new RexStaticPageError(entry.page, entry.path, "cannot be regenerated: no page renderer is registered");
    }
    const rendered = await renderPrerenderedHtml(renderer, new URL(entry.path, origin), actor);
    if (rendered.page !== entry.page) {
      throw new RexStaticPageError(
        entry.page,
        entry.path,
        `cannot be regenerated: the path now renders page "${rendered.page}"`,
      );
    }
    await store.write(entry.path, rendered.html);
    const next = Object.freeze({ ...entry, generatedAt: Date.now() });
    entries.set(entry.path, next);
    return next;
  }

  function regenerate(
    pathname: string,
    origin: string,
    renderer: RexPageRenderer | undefined,
  ): Promise<StaticPageEntry> {
    const entry = lookup(pathname);
    if (entry === undefined) {
      return Promise.reject(new TypeError(`no prerendered page is listed at ${pathname}`));
    }
    const running = inFlight.get(entry.path);
    if (running !== undefined) return running;
    const started = render(entry, origin, renderer).finally(() => {
      inFlight.delete(entry.path);
    });
    inFlight.set(entry.path, started);
    return started;
  }

  async function serve(
    request: Request,
    renderer: RexPageRenderer | undefined,
    nonce: string,
  ): Promise<StaticHit | null> {
    const url = new URL(request.url);
    const entry = lookup(url.pathname);
    if (entry === undefined) return null;
    let status: StaticServeStatus = "hit";
    let html = await store.read(entry.path);
    if (html === null) {
      await regenerate(entry.path, url.origin, renderer);
      html = await store.read(entry.path);
      if (html === null) {
        throw new RexStaticPageError(entry.page, entry.path, "was regenerated but the store returned nothing");
      }
      status = "generated";
    } else if (isStale(entry, Date.now())) {
      status = "stale";
      if (!inFlight.has(entry.path)) {
        regenerate(entry.path, url.origin, renderer).catch((error: unknown) => {
          onError(error, entry);
        });
      }
    }
    let setCookie: string | null = null;
    let body = fillNonce(html, nonce);
    if (hasCsrfField(body)) {
      const grant = ensureCsrfToken(request);
      setCookie = grant.setCookie;
      body = fillCsrfToken(body, grant.token);
    }
    return { page: entry.page, path: entry.path, status, html: body, setCookie };
  }

  return Object.freeze({
    get size() {
      return entries.size;
    },
    has: (pathname: string) => lookup(pathname) !== undefined,
    entry: lookup,
    entries: () => Object.freeze([...entries.values()]),
    serve,
    regenerate,
    async settled() {
      while (inFlight.size > 0) {
        await Promise.allSettled([...inFlight.values()]);
      }
    },
  });
}

const caches = new WeakMap<object, StaticCache>();

export function registerStaticCache(registry: object, cache: StaticCache): () => void {
  if (typeof registry !== "object" || registry === null) {
    throw new TypeError("registerStaticCache: registry must be the app registry object");
  }
  if (typeof cache !== "object" || cache === null || typeof cache.serve !== "function") {
    throw new TypeError("registerStaticCache: cache must come from createStaticCache");
  }
  caches.set(registry, cache);
  return () => {
    if (caches.get(registry) === cache) caches.delete(registry);
  };
}

export function staticCacheFor(registry: object): StaticCache | undefined {
  return caches.get(registry);
}
