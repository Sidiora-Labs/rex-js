import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { RexEntryBundle } from "../client/entry.tsx";
import type { EagerPageModuleSet, LazyPageModuleSet, PageModuleSet } from "../client/page.tsx";
import { anonymousActor, type Actor } from "../core/actor.ts";
import type { FontSpec } from "../core/config.ts";
import { isPlainObject } from "../core/entity.ts";
import { RexError } from "../core/errors.ts";
import { parseRoute, type AnyPage, type PageRender, type PageStatesModule } from "../core/page.ts";
import type { Manifest } from "../manifest/types.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_LIST_VERSION,
  RexStaticPageError,
  isPrerenderMode,
  prerenderedFile,
  renderPrerenderedHtml,
  serializePrerenderList,
  type PrerenderList,
  type PrerenderMode,
  type StaticPageEntry,
} from "../server/adapters/static-cache.ts";
import { memoryLedger, type Ledger } from "../server/audit.ts";
import { formPath } from "../server/form.ts";
import type { RexPageRenderer } from "../server/routes/render.ts";
import type { RexDocumentAssets, RexRendererOptions } from "../server/ssr.ts";

export const PRERENDER_ORIGIN = "http://localhost";
export const REX_DATA_SCRIPT = /<script type="application\/rex\+data"[^>]*>[\s\S]*?<\/script>/g;
export const MODULE_SCRIPT = /<script type="module"[^>]*><\/script>/g;
export const MODULE_PRELOAD = /<link rel="modulepreload"[^>]*>/g;
export const SSR_ROOT_ATTRIBUTE = / data-rex-ssr=""/g;

export interface PrerenderRuntime {
  createRexRenderer(options: RexRendererOptions): RexPageRenderer;
  pageRenderMode(manifest: Manifest, declared: AnyPage): PageRender;
}

export interface PrerenderSource {
  readonly bundle: RexEntryBundle;
  readonly ssr: PrerenderRuntime;
  readonly assets: RexDocumentAssets;
  readonly rootElement?: string;
  readonly fonts?: readonly FontSpec[];
}

export interface PrerenderOptions {
  readonly clientDir: string;
  readonly origin?: string;
  readonly actor?: Actor;
  readonly ledger?: Ledger;
}

export function prerenderMode(ssr: PrerenderRuntime, manifest: Manifest, declared: AnyPage): PrerenderMode | null {
  const mode = ssr.pageRenderMode(manifest, declared);
  return isPrerenderMode(mode) ? mode : null;
}

function pathsError(declared: AnyPage, problem: string): RexError {
  return new RexError("REX202", `page ${JSON.stringify(declared.id)}: field "paths" ${problem}`);
}

export function routePath(declared: AnyPage, params: unknown): string {
  const parsed = parseRoute(declared.route);
  if (parsed.params.length === 0) return declared.route;
  if (!isPlainObject(params)) throw pathsError(declared, "must return a list of params objects");
  const segments = parsed.segments.map((segment) => {
    if (segment.kind === "static") return segment.value;
    const value = params[segment.name];
    if (typeof value !== "string" && typeof value !== "number") {
      throw pathsError(declared, `returned params without a string or number "${segment.name}"`);
    }
    const text = String(value);
    if (text === "" || text === "." || text === ".." || /[/\\\0]/.test(text)) {
      throw pathsError(declared, `returned "${segment.name}" ${JSON.stringify(text)}, which is not one path segment`);
    }
    return encodeURIComponent(text);
  });
  return `/${segments.join("/")}`;
}

export async function expandPagePaths(declared: AnyPage): Promise<string[]> {
  if (declared.routeParams.length === 0) return [declared.route];
  if (declared.paths === null) {
    throw pathsError(declared, `is required to prerender route ${declared.route}`);
  }
  const listed: unknown = await declared.paths();
  if (!Array.isArray(listed)) throw pathsError(declared, "must return a list of params objects");
  return [...new Set(listed.map((params) => routePath(declared, params)))];
}

export function stripHydration(html: string): string {
  return html
    .replace(REX_DATA_SCRIPT, "")
    .replace(MODULE_SCRIPT, "")
    .replace(MODULE_PRELOAD, "")
    .replace(SSR_ROOT_ATTRIBUTE, "");
}

function isLazy(set: PageModuleSet): set is LazyPageModuleSet {
  return typeof (set as { load?: unknown }).load === "function";
}

async function eagerModules(set: PageModuleSet): Promise<EagerPageModuleSet> {
  if (!isLazy(set)) return set;
  const loaded = await set.load();
  return {
    page: set.page,
    view: loaded.view as EagerPageModuleSet["view"],
    states: loaded.states as PageStatesModule<AnyPage>,
    regions: (loaded.regions ?? {}) as EagerPageModuleSet["regions"],
    overlays: (loaded.overlays ?? {}) as EagerPageModuleSet["overlays"],
  } as EagerPageModuleSet;
}

function missingForms(declared: AnyPage, html: string): string[] {
  return declared.actions
    .map((entry) => entry.id)
    .filter((id) => !html.includes(`action="${formPath(id)}"`));
}

export async function prerenderPages(
  source: PrerenderSource,
  options: PrerenderOptions,
): Promise<PrerenderList> {
  const { bundle, ssr, assets } = source;
  const manifest = bundle.manifest;
  if (manifest === undefined) {
    throw new RexError("REX400", "prerenderPages: the bundle must carry its manifest");
  }
  const clientDir = resolve(options.clientDir);
  const origin = options.origin ?? PRERENDER_ORIGIN;
  const actor = options.actor ?? anonymousActor;
  const ledger = options.ledger ?? memoryLedger();
  const rendererOptions = (pages: readonly PageModuleSet[]): RexRendererOptions => ({
    bundle: { ...bundle, pages },
    assets,
    ...(source.rootElement === undefined ? {} : { rootElement: source.rootElement }),
    fonts: source.fonts ?? [],
    ledger,
  });

  const targets = bundle.pages
    .map((set) => ({ set, mode: prerenderMode(ssr, manifest, set.page) }))
    .filter((target): target is { set: PageModuleSet; mode: PrerenderMode } => target.mode !== null)
    .sort((a, b) => (a.set.page.id < b.set.page.id ? -1 : a.set.page.id > b.set.page.id ? 1 : 0));
  if (targets.length === 0) return { version: PRERENDER_LIST_VERSION, pages: [] };

  const eager = new Map<string, EagerPageModuleSet>();
  for (const target of targets) {
    if (target.mode === "static") eager.set(target.set.page.id, await eagerModules(target.set));
  }
  const hydrating = ssr.createRexRenderer(rendererOptions(bundle.pages));
  const zeroJs =
    eager.size === 0
      ? hydrating
      : ssr.createRexRenderer(rendererOptions(bundle.pages.map((set) => eager.get(set.page.id) ?? set)));

  const pages: StaticPageEntry[] = [];
  const seen = new Set<string>();
  for (const { set, mode } of targets) {
    const declared = set.page;
    for (const path of await expandPagePaths(declared)) {
      if (seen.has(path)) {
        throw new RexStaticPageError(declared.id, path, "is prerendered by more than one page");
      }
      seen.add(path);
      const rendered = await renderPrerenderedHtml(
        mode === "static" ? zeroJs : hydrating,
        new URL(path, origin),
        actor,
      );
      if (rendered.page !== declared.id) {
        throw new RexStaticPageError(declared.id, path, `renders page "${rendered.page}" instead`);
      }
      const html = mode === "static" ? stripHydration(rendered.html) : rendered.html;
      if (mode === "static") {
        const missing = missingForms(declared, html);
        if (missing.length > 0) {
          throw new RexStaticPageError(
            declared.id,
            path,
            `renders static but action ${missing.map((id) => `"${id}"`).join(", ")} is not rendered as a form; render it with ActionForm so it works without JavaScript`,
          );
        }
      }
      const file = prerenderedFile(path);
      const target = join(clientDir, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, html, "utf8");
      pages.push(
        Object.freeze({
          path,
          page: declared.id,
          render: mode,
          revalidate: mode === "ssg" ? declared.revalidate : null,
          file,
          generatedAt: Date.now(),
        }),
      );
    }
  }
  return Object.freeze({ version: PRERENDER_LIST_VERSION, pages: Object.freeze(pages) });
}

export function writePrerenderList(outDir: string, list: PrerenderList): string {
  const file = join(resolve(outDir), PRERENDER_LIST_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, serializePrerenderList(list), "utf8");
  return file;
}

export function formatPrerenderList(list: PrerenderList, clientDir = "dist/client"): string {
  if (list.pages.length === 0) return "rex build: no ssg or static pages to prerender\n";
  return list.pages
    .map((entry) => {
      const revalidate = entry.revalidate === null ? "" : `, revalidate ${entry.revalidate}s`;
      return `rex build: prerendered ${entry.path} -> ${clientDir}/${entry.file} (${entry.page}, ${entry.render}${revalidate})\n`;
    })
    .join("");
}
