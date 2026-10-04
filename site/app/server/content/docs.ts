import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  DOCS_DIR,
  README_FILE,
  RECIPES_DIR,
  docRoute,
  recipeRoute,
  renderMarkdown,
  repositoryRoot,
  repositoryUrl,
  type MarkdownHeading,
} from "./markdown.ts";
import type { SearchEntry } from "./search.ts";

export const DOC_KINDS = ["guide", "recipe"] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export interface DocSection {
  readonly kind: DocKind;
  readonly title: string;
  readonly dir: string;
  readonly orderFile: string;
  readonly orderHeading: string | null;
  route(slug: string): string;
}

export const DOC_SECTIONS: Readonly<Record<DocKind, DocSection>> = Object.freeze({
  guide: Object.freeze({
    kind: "guide",
    title: "Guides",
    dir: DOCS_DIR,
    orderFile: README_FILE,
    orderHeading: "Documentation",
    route: docRoute,
  }),
  recipe: Object.freeze({
    kind: "recipe",
    title: "Recipes",
    dir: RECIPES_DIR,
    orderFile: `${RECIPES_DIR}/${README_FILE}`,
    orderHeading: null,
    route: recipeRoute,
  }),
});

export interface DocSummary {
  readonly kind: DocKind;
  readonly slug: string;
  readonly title: string;
  readonly route: string;
  readonly file: string;
  readonly source: string;
  readonly summary: string;
  readonly headings: readonly MarkdownHeading[];
}

export interface DocArticle extends DocSummary {
  readonly html: string;
}

const MARKDOWN_LINK = /\]\(([^)\s#]+\.md)(?:#[^)\s]*)?\)/g;
const cache = new Map<string, Promise<DocArticle>>();

function absolute(file: string): string {
  return path.join(repositoryRoot(), file);
}

export function docFiles(kind: DocKind): readonly string[] {
  const { dir } = DOC_SECTIONS[kind];
  return readdirSync(absolute(dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== README_FILE)
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

export function docSlug(file: string): string {
  return path.posix.basename(file, ".md");
}

export function docSlugs(kind: DocKind): readonly string[] {
  return docFiles(kind).map(docSlug);
}

function orderedText(text: string, file: string, heading: string | null): string {
  if (heading === null) return text;
  const lines = text.split("\n");
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`rex-site: ${file} has no "## ${heading}" section`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

export function readingOrder(kind: DocKind): readonly string[] {
  const { dir, orderFile, orderHeading } = DOC_SECTIONS[kind];
  const text = orderedText(readFileSync(absolute(orderFile), "utf8"), orderFile, orderHeading);
  const base = path.posix.dirname(orderFile);
  const files = docFiles(kind);
  const ordered: string[] = [];
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const target = path.posix.normalize(path.posix.join(base, match[1] as string));
    if (path.posix.dirname(target) !== dir) continue;
    if (files.includes(target) && !ordered.includes(target)) ordered.push(target);
  }
  return [...ordered, ...files.filter((file) => !ordered.includes(file))];
}

function fileFor(kind: DocKind, slug: string): string {
  const file = `${DOC_SECTIONS[kind].dir}/${slug}.md`;
  if (!docFiles(kind).includes(file)) {
    throw new Error(`rex-site: no ${kind} "${slug}" under ${DOC_SECTIONS[kind].dir}/`);
  }
  return file;
}

async function renderDoc(kind: DocKind, file: string): Promise<DocArticle> {
  const source = readFileSync(absolute(file), "utf8");
  const rendered = await renderMarkdown(source, file);
  const slug = docSlug(file);
  return {
    kind,
    slug,
    title: rendered.title,
    route: DOC_SECTIONS[kind].route(slug),
    file,
    source: repositoryUrl(file),
    summary: rendered.summary,
    headings: rendered.headings,
    html: rendered.html,
  };
}

export function readDoc(kind: DocKind, slug: string): Promise<DocArticle> {
  const file = fileFor(kind, slug);
  const key = `${file}:${statSync(absolute(file)).mtimeMs}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const rendering = renderDoc(kind, file);
  cache.set(key, rendering);
  rendering.catch(() => cache.delete(key));
  return rendering;
}

export function summaryOf(article: DocArticle): DocSummary {
  const { html: _html, ...summary } = article;
  return summary;
}

export async function listDocs(kind: DocKind): Promise<readonly DocSummary[]> {
  const articles = await Promise.all(
    readingOrder(kind).map((file) => readDoc(kind, docSlug(file))),
  );
  return articles.map(summaryOf);
}

export async function searchEntries(): Promise<readonly SearchEntry[]> {
  const entries: SearchEntry[] = [];
  for (const kind of DOC_KINDS) {
    for (const doc of await listDocs(kind)) {
      entries.push({
        section: DOC_SECTIONS[kind].title,
        title: doc.title,
        route: doc.route,
        headings: doc.headings.map((heading) => heading.text),
        summary: doc.summary,
      });
    }
  }
  return entries;
}
