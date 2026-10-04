import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  API_DIR,
  README_FILE,
  apiRoute,
  apiSlug,
  headingSlug,
  renderMarkdown,
  repositoryRoot,
  repositoryUrl,
  toPosix,
  type MarkdownHeading,
} from "./markdown.ts";

export const PACKAGE_FILE = "packages/rex/package.json";
export const ROOT_ENTRY = ".";
export const KIND_DEPTH = 2;
export const SYMBOL_DEPTH = 3;

const TITLE_LINE = /^# /m;
const NON_MODULE_EXPORT = /\.json$/;
const ANCHOR = /<a id="([^"]+)"><\/a>/g;
const HEADING = /(?:<p><a id="([^"]+)"><\/a><\/p>\n)?<h([1-6]) id="([^"]+)">/g;

const SINGULAR_KINDS: Readonly<Record<string, string>> = Object.freeze({
  Classes: "class",
  Interfaces: "interface",
  Functions: "function",
  Variables: "variable",
  "Type Aliases": "type alias",
  References: "reference",
  Enumerations: "enumeration",
  Namespaces: "namespace",
});

export interface ApiSymbol {
  readonly name: string;
  readonly id: string;
}

export interface ApiKind {
  readonly title: string;
  readonly id: string;
  readonly symbols: readonly ApiSymbol[];
}

export interface ApiSummary {
  readonly slug: string;
  readonly title: string;
  readonly entry: string;
  readonly route: string;
  readonly file: string;
  readonly source: string;
  readonly summary: string;
  readonly headings: readonly MarkdownHeading[];
  readonly kinds: readonly ApiKind[];
}

export interface ApiArticle extends ApiSummary {
  readonly html: string;
}

export interface ApiPackage {
  readonly name: string;
  readonly version: string;
  readonly entries: readonly string[];
}

export interface ApiSearchEntry {
  readonly slug: string;
  readonly title: string;
  readonly route: string;
  readonly headings: string[];
  readonly summary: string;
}

const cache = new Map<string, Promise<ApiArticle>>();

function absolute(file: string): string {
  return path.join(repositoryRoot(), file);
}

export function apiPackage(): ApiPackage {
  const manifest = JSON.parse(readFileSync(absolute(PACKAGE_FILE), "utf8")) as {
    readonly name?: unknown;
    readonly version?: unknown;
    readonly exports?: unknown;
  };
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string") {
    throw new Error(`rex-site: ${PACKAGE_FILE} has no name or version`);
  }
  if (typeof manifest.exports !== "object" || manifest.exports === null) {
    throw new Error(`rex-site: ${PACKAGE_FILE} declares no exports map`);
  }
  return {
    name: manifest.name,
    version: manifest.version,
    entries: Object.keys(manifest.exports).filter((entry) => !NON_MODULE_EXPORT.test(entry)),
  };
}

export function entryOf(moduleName: string, packageName: string): string {
  if (moduleName === packageName) return ROOT_ENTRY;
  if (moduleName.startsWith(`${packageName}/`)) {
    return `./${moduleName.slice(packageName.length + 1)}`;
  }
  throw new Error(`rex-site: "${moduleName}" is not a module of ${packageName}`);
}

export function apiFiles(): readonly string[] {
  const entries = readdirSync(absolute(API_DIR), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) =>
      toPosix(path.relative(repositoryRoot(), path.join(entry.parentPath, entry.name))),
    )
    .filter((file) => file !== `${API_DIR}/${README_FILE}`)
    .sort();
}

export function apiFileSlug(file: string): string {
  return apiSlug(toPosix(file).slice(API_DIR.length + 1));
}

export function apiSlugs(): readonly string[] {
  return apiFiles().map(apiFileSlug);
}

function fileFor(slug: string): string {
  const file = apiFiles().find((candidate) => apiFileSlug(candidate) === slug);
  if (file === undefined) throw new Error(`rex-site: no API page "${slug}" under ${API_DIR}/`);
  return file;
}

export function articleSource(source: string, file: string): string {
  const title = TITLE_LINE.exec(source);
  if (title === null) throw new Error(`rex-site: ${file} has no level-one heading to title it`);
  return source.slice(title.index);
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let count = 1; used.has(id); count += 1) id = `${base}-${count}`;
  used.add(id);
  return id;
}

interface Anchored {
  readonly html: string;
  readonly headings: readonly MarkdownHeading[];
}

export function anchorHeadings(
  html: string,
  title: string,
  headings: readonly MarkdownHeading[],
  file: string,
): Anchored {
  const used = new Set([...html.matchAll(ANCHOR)].map((match) => match[1] as string));
  const ids: string[] = [];
  let index = 0;
  const rewritten = html.replace(
    HEADING,
    (_match, anchor: string | undefined, level: string, _id: string) => {
      const text = index === 0 ? title : headings[index - 1]?.text;
      if (text === undefined) {
        throw new Error(`rex-site: ${file} renders more headings than its heading list`);
      }
      index += 1;
      const id = anchor ?? uniqueId(headingSlug(text), used);
      ids.push(id);
      return `<h${level} id="${id}">`;
    },
  );
  if (index !== headings.length + 1) {
    throw new Error(`rex-site: ${file} renders ${index} headings for ${headings.length + 1}`);
  }
  return {
    html: rewritten,
    headings: headings.map((heading, at) => ({ ...heading, id: ids[at + 1] as string })),
  };
}

export function apiKinds(headings: readonly MarkdownHeading[]): readonly ApiKind[] {
  const kinds: { title: string; id: string; symbols: ApiSymbol[] }[] = [];
  for (const heading of headings) {
    if (heading.depth === KIND_DEPTH) {
      kinds.push({ title: heading.text, id: heading.id, symbols: [] });
    } else if (heading.depth === SYMBOL_DEPTH) {
      const kind = kinds.at(-1);
      if (kind !== undefined) kind.symbols.push({ name: heading.text, id: heading.id });
    }
  }
  return kinds;
}

function kindCount(kind: ApiKind): string {
  const count = kind.symbols.length;
  const plural = kind.title.toLowerCase();
  return `${count} ${count === 1 ? (SINGULAR_KINDS[kind.title] ?? plural) : plural}`;
}

export function kindsSummary(entry: string, kinds: readonly ApiKind[]): string {
  const total = kinds.reduce((sum, kind) => sum + kind.symbols.length, 0);
  const counts = kinds.map(kindCount);
  const listed =
    counts.length <= 1
      ? (counts[0] ?? "nothing")
      : `${counts.slice(0, -1).join(", ")} and ${counts.at(-1) as string}`;
  return `The ${entry} entry exports ${total} ${total === 1 ? "symbol" : "symbols"}: ${listed}.`;
}

async function renderApi(file: string): Promise<ApiArticle> {
  const source = articleSource(readFileSync(absolute(file), "utf8"), file);
  const rendered = await renderMarkdown(source, file);
  const anchored = anchorHeadings(rendered.html, rendered.title, rendered.headings, file);
  const entry = entryOf(rendered.title, apiPackage().name);
  const kinds = apiKinds(anchored.headings);
  const slug = apiFileSlug(file);
  return {
    slug,
    title: rendered.title,
    entry,
    route: apiRoute(slug),
    file,
    source: repositoryUrl(file),
    summary: kindsSummary(entry, kinds),
    headings: anchored.headings,
    kinds,
    html: anchored.html,
  };
}

export function readApiDoc(slug: string): Promise<ApiArticle> {
  const file = fileFor(slug);
  const key = `${file}:${statSync(absolute(file)).mtimeMs}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const rendering = renderApi(file);
  cache.set(key, rendering);
  rendering.catch(() => cache.delete(key));
  return rendering;
}

export function apiSummaryOf(article: ApiArticle): ApiSummary {
  const { html: _html, ...summary } = article;
  return summary;
}

export async function listApi(): Promise<readonly ApiSummary[]> {
  const { name, entries } = apiPackage();
  const articles = (await Promise.all(apiSlugs().map(readApiDoc))).map(apiSummaryOf);
  const byEntry = new Map<string, ApiSummary>();
  for (const article of articles) {
    if (!entries.includes(article.entry)) {
      throw new Error(
        `rex-site: ${article.file} documents ${article.title}, which ${PACKAGE_FILE} does not export`,
      );
    }
    if (byEntry.has(article.entry)) {
      throw new Error(`rex-site: ${API_DIR}/ documents ${article.title} twice`);
    }
    byEntry.set(article.entry, article);
  }
  return entries.map((entry) => {
    const article = byEntry.get(entry);
    if (article === undefined) {
      throw new Error(`rex-site: ${API_DIR}/ has no page for the ${name} entry ${entry}`);
    }
    return article;
  });
}

export async function apiSearchEntries(): Promise<readonly ApiSearchEntry[]> {
  return (await listApi()).map((article) => ({
    slug: article.slug,
    title: article.title,
    route: article.route,
    headings: article.headings
      .filter((heading) => heading.depth <= SYMBOL_DEPTH)
      .map((heading) => heading.text),
    summary: article.summary,
  }));
}
