import { Marked, type Token, type Tokens } from "marked";
import {
  bundledLanguages,
  createCssVariablesTheme,
  createHighlighter,
  createJavaScriptRegexEngine,
  type BundledLanguage,
  type Highlighter,
} from "shiki";
import type { MarkdownHeading, MarkdownValue } from "../schema/fields.ts";

export const MARKDOWN_THEME = "css-variables";
export const MARKDOWN_VARIABLE_PREFIX = "--shiki-";
export const MARKDOWN_PLAIN_LANGUAGE = "text";
export const MARKDOWN_EMPTY_HEADING_ID = "section";

export interface MarkdownLinkContext {
  readonly slug: string | null;
}

export type MarkdownLinks = (href: string, context: MarkdownLinkContext) => string;

export interface RenderMarkdownOptions {
  readonly slug?: string;
  readonly links?: MarkdownLinks;
}

const theme = createCssVariablesTheme({
  name: MARKDOWN_THEME,
  variablePrefix: MARKDOWN_VARIABLE_PREFIX,
});

let highlighter: Promise<Highlighter> | null = null;

function markdownHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({
    themes: [theme],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighter;
}

export function codeLanguage(info: string | undefined): string {
  const name = (info ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return Object.hasOwn(bundledLanguages, name) ? name : MARKDOWN_PLAIN_LANGUAGE;
}

export async function highlightCode(code: string, info?: string): Promise<string> {
  const shiki = await markdownHighlighter();
  const lang = codeLanguage(info);
  if (lang !== MARKDOWN_PLAIN_LANGUAGE && !shiki.getLoadedLanguages().includes(lang)) {
    await shiki.loadLanguage(lang as BundledLanguage);
  }
  return shiki.codeToHtml(code, { lang, theme: MARKDOWN_THEME });
}

export function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
  return slug === "" ? MARKDOWN_EMPTY_HEADING_ID : slug;
}

export function headingSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = slugify(text);
    let slug = base;
    let count = seen.get(base) ?? 0;
    while (seen.has(slug)) slug = `${base}-${++count}`;
    seen.set(base, count);
    seen.set(slug, 0);
    return slug;
  };
}

export function isRelativeLink(href: string): boolean {
  return href !== "" && !/^([a-z][a-z0-9+.-]*:|[/#?])/i.test(href);
}

function inlineText(tokens: readonly Token[] | undefined): string {
  return (tokens ?? [])
    .map((token): string => {
      if (token.type === "br") return "\n";
      if (token.type === "html" || token.type === "tag") return "";
      if (token.type !== "image" && "tokens" in token && Array.isArray(token.tokens)) {
        return inlineText(token.tokens as Token[]);
      }
      return "text" in token && typeof token.text === "string" ? token.text : "";
    })
    .join("");
}

function blockText(token: Token): string {
  switch (token.type) {
    case "heading":
    case "paragraph":
      return inlineText((token as Tokens.Heading | Tokens.Paragraph).tokens);
    case "text": {
      const text = token as Tokens.Text;
      return text.tokens === undefined ? text.text : inlineText(text.tokens);
    }
    case "code":
      return (token as Tokens.Code).text;
    case "blockquote":
      return blocksText((token as Tokens.Blockquote).tokens);
    case "list":
      return (token as Tokens.List).items.map((item) => blocksText(item.tokens)).join("\n");
    case "table": {
      const table = token as Tokens.Table;
      return [table.header, ...table.rows]
        .map((row) => row.map((cell) => inlineText(cell.tokens)).join(" | "))
        .join("\n");
    }
    default:
      return "";
  }
}

function blocksText(tokens: readonly Token[]): string {
  return tokens
    .map(blockText)
    .filter((text) => text !== "")
    .join("\n\n");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export async function renderMarkdown(
  source: string,
  options: RenderMarkdownOptions = {},
): Promise<MarkdownValue> {
  const marked = new Marked({ gfm: true, async: false });
  const tokens = marked.lexer(source);
  const slug = headingSlugger();
  const headings: MarkdownHeading[] = [];
  const headingIds = new Map<Token, string>();
  const codes: Tokens.Code[] = [];
  const context: MarkdownLinkContext = { slug: options.slug ?? null };
  marked.walkTokens(tokens, (token) => {
    if (token.type === "heading") {
      const heading = token as Tokens.Heading;
      const text = inlineText(heading.tokens);
      const id = slug(text);
      headingIds.set(token, id);
      headings.push(Object.freeze({ depth: heading.depth, id, text }));
    } else if (token.type === "code") {
      codes.push(token as Tokens.Code);
    } else if (token.type === "link" && options.links !== undefined) {
      const link = token as Tokens.Link;
      if (isRelativeLink(link.href)) link.href = options.links(link.href, context);
    }
  });
  const highlighted = new Map<Token, string>();
  for (const code of codes) highlighted.set(code, await highlightCode(code.text, code.lang));
  marked.use({
    renderer: {
      heading(token) {
        const id = headingIds.get(token) as string;
        return `<h${token.depth} id="${escapeAttribute(id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      code(token) {
        return `${highlighted.get(token) as string}\n`;
      },
    },
  });
  return Object.freeze({
    source,
    html: marked.parser(tokens),
    headings: Object.freeze(headings),
    text: blocksText(tokens),
  });
}
