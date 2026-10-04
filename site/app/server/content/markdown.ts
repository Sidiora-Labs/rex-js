import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Marked, type Token, type Tokens } from "marked";
import { bundledLanguages, bundledLanguagesAlias, getSingletonHighlighter } from "shiki";

export const REPOSITORY_URL = "https://github.com/Sidiora-Labs/rex-js";
export const REPOSITORY_BRANCH = "main";
export const WORKSPACE_MARKER = "pnpm-workspace.yaml";
export const DOCS_DIR = "docs";
export const RECIPES_DIR = "docs/recipes";
export const API_DIR = "docs/api";
export const README_FILE = "README.md";
export const CHANGELOG_FILE = "CHANGELOG.md";
export const CODE_THEMES = Object.freeze({ light: "github-light", dark: "github-dark" });
export const PLAIN_LANGUAGE = "text";
export const TITLE_DEPTH = 1;
export const TOC_DEPTHS: readonly number[] = [2, 3];
export const HEADING_SHIFT = 1;
export const MAX_HEADING_LEVEL = 6;

export interface MarkdownHeading {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

export interface RenderedMarkdown {
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly MarkdownHeading[];
  readonly html: string;
}

const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;
const MARKDOWN_FILE = /\.md$/;

let cachedRoot: string | null = null;

export function repositoryRoot(): string {
  if (cachedRoot !== null) return cachedRoot;
  let dir = path.resolve(process.cwd());
  for (;;) {
    if (existsSync(path.join(dir, WORKSPACE_MARKER)) && existsSync(path.join(dir, DOCS_DIR))) {
      cachedRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `rex-site: no repository root (a directory with ${WORKSPACE_MARKER} and ${DOCS_DIR}/) above ${process.cwd()}`,
      );
    }
    dir = parent;
  }
}

export function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

export function apiSlug(relativeToApi: string): string {
  return toPosix(relativeToApi)
    .replace(MARKDOWN_FILE, "")
    .split("/")
    .map((segment) => segment.replace(/^@/, ""))
    .join("-")
    .toLowerCase();
}

export function docRoute(slug: string): string {
  return `/docs/${slug}`;
}

export function recipeRoute(slug: string): string {
  return `/docs/recipes/${slug}`;
}

export function apiRoute(slug: string): string {
  return `/api/${slug}`;
}

export function repositoryUrl(file: string): string {
  const absolute = path.join(repositoryRoot(), file);
  const kind = existsSync(absolute) && statSync(absolute).isDirectory() ? "tree" : "blob";
  return `${REPOSITORY_URL}/${kind}/${REPOSITORY_BRANCH}/${file}`;
}

export function siteRouteOf(file: string): string | null {
  const posix = toPosix(file);
  if (posix === `${DOCS_DIR}/${README_FILE}` || posix === `${RECIPES_DIR}/${README_FILE}`) {
    return "/docs";
  }
  if (posix === `${API_DIR}/${README_FILE}`) return "/api";
  if (posix === CHANGELOG_FILE) return "/changelog";
  if (!MARKDOWN_FILE.test(posix)) return null;
  if (posix.startsWith(`${API_DIR}/`)) {
    return apiRoute(apiSlug(posix.slice(API_DIR.length + 1)));
  }
  const dir = path.posix.dirname(posix);
  const slug = path.posix.basename(posix).replace(MARKDOWN_FILE, "");
  if (dir === DOCS_DIR) return docRoute(slug);
  if (dir === RECIPES_DIR) return recipeRoute(slug);
  return null;
}

export function rewriteHref(href: string, fromFile: string): string {
  if (href === "" || href.startsWith("#") || href.startsWith("/") || EXTERNAL.test(href)) {
    return href;
  }
  const hashAt = href.indexOf("#");
  const target = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(toPosix(fromFile)), decodeURI(target)),
  );
  if (resolved.startsWith("../")) return href;
  const route = siteRouteOf(resolved);
  if (route !== null) return `${route}${hash}`;
  return `${repositoryUrl(resolved.replace(/\/$/, ""))}${hash}`;
}

export function plainText(tokens: readonly Token[]): string {
  let text = "";
  for (const token of tokens) {
    const entry = token as {
      readonly type: string;
      readonly text?: unknown;
      readonly tokens?: Token[];
    };
    if (entry.type === "image") continue;
    if (Array.isArray(entry.tokens) && entry.tokens.length > 0) {
      text += plainText(entry.tokens);
    } else if (typeof entry.text === "string") {
      text += entry.text;
    } else if (entry.type === "br" || entry.type === "space") {
      text += " ";
    }
  }
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = headingSlug(text);
    const count = seen.get(base);
    seen.set(base, (count ?? 0) + 1);
    return count === undefined ? base : `${base}-${count}`;
  };
}

function codeLanguage(lang: string | undefined): string {
  const name = (lang ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (name === "") return PLAIN_LANGUAGE;
  if (name in bundledLanguages || name in bundledLanguagesAlias) return name;
  return PLAIN_LANGUAGE;
}

async function highlighter() {
  return getSingletonHighlighter({ themes: [CODE_THEMES.light, CODE_THEMES.dark], langs: [] });
}

export async function highlightCode(code: string, lang: string | undefined): Promise<string> {
  const language = codeLanguage(lang);
  const shiki = await highlighter();
  if (language !== PLAIN_LANGUAGE && !shiki.getLoadedLanguages().includes(language)) {
    await shiki.loadLanguage(language as keyof typeof bundledLanguages);
  }
  return shiki.codeToHtml(code, {
    lang: language,
    themes: { light: CODE_THEMES.light, dark: CODE_THEMES.dark },
    defaultColor: false,
  });
}

export async function renderMarkdown(source: string, file: string): Promise<RenderedMarkdown> {
  const slug = createSlugger();
  const headings: MarkdownHeading[] = [];
  const highlighted = new WeakMap<Tokens.Code, string>();
  let title: string | null = null;
  let summary: string | null = null;
  const marked = new Marked({
    async: true,
    gfm: true,
    async walkTokens(token) {
      if (token.type === "link") {
        const link = token as Tokens.Link;
        link.href = rewriteHref(link.href, file);
      } else if (token.type === "code") {
        const code = token as Tokens.Code;
        highlighted.set(code, await highlightCode(code.text, code.lang));
      }
    },
    renderer: {
      heading(token) {
        const text = plainText(token.tokens);
        const id = slug(text);
        if (token.depth === TITLE_DEPTH && title === null) title = text;
        else headings.push({ depth: token.depth, id, text });
        const level = Math.min(token.depth + HEADING_SHIFT, MAX_HEADING_LEVEL);
        return `<h${level} id="${escapeHtml(id)}">${this.parser.parseInline(token.tokens)}</h${level}>\n`;
      },
      code(token) {
        const html = highlighted.get(token);
        if (html === undefined) {
          throw new Error(`rex-site: the code block in ${file} was not highlighted`);
        }
        return `${html}\n`;
      },
      paragraph(token) {
        if (summary === null) summary = plainText(token.tokens);
        return false;
      },
    },
  });
  const html = await marked.parse(source);
  if (title === null) throw new Error(`rex-site: ${file} has no level-one heading to title it`);
  return { title, summary: summary ?? "", headings, html };
}
