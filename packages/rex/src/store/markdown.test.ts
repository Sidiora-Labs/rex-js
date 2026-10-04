import { describe, expect, it } from "vitest";
import { markdown } from "../schema/index.ts";
import {
  MARKDOWN_PLAIN_LANGUAGE,
  codeLanguage,
  headingSlugger,
  highlightCode,
  isRelativeLink,
  renderMarkdown,
  slugify,
} from "./markdown.ts";

const MARKDOWN_TEST_TIMEOUT_MS = 60_000;

const GUIDE = [
  "# Getting started",
  "",
  "Rex reads **markdown** with `code` and [a sibling](./setup.md#install).",
  "",
  "## Install it",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "## Install it",
  "",
  "- one",
  "- two",
  "",
  "> A quote with [the site](https://example.com) and [a hash](#install-it).",
  "",
  "### Café & crème?",
  "",
  "| Name | Kind |",
  "| ---- | ---- |",
  "| id | text |",
  "",
].join("\n");

describe("renderMarkdown", { timeout: MARKDOWN_TEST_TIMEOUT_MS }, () => {
  it("gives every heading a unique id and lists the headings in order", async () => {
    const rendered = await renderMarkdown(GUIDE);
    expect(rendered.headings).toEqual([
      { depth: 1, id: "getting-started", text: "Getting started" },
      { depth: 2, id: "install-it", text: "Install it" },
      { depth: 2, id: "install-it-1", text: "Install it" },
      { depth: 3, id: "café--crème", text: "Café & crème?" },
    ]);
    expect(rendered.html).toContain('<h1 id="getting-started">Getting started</h1>');
    expect(rendered.html).toContain('<h2 id="install-it">Install it</h2>');
    expect(rendered.html).toContain('<h2 id="install-it-1">Install it</h2>');
    expect(rendered.html).toContain('<h3 id="café--crème">Café &amp; crème?</h3>');
    expect(rendered.source).toBe(GUIDE);
    expect(markdown().parse(rendered)).toEqual(rendered);
  });

  it("highlights fenced code with the CSS-variable theme so both colour schemes apply", async () => {
    const rendered = await renderMarkdown(GUIDE);
    expect(rendered.html).toContain('<pre class="shiki css-variables"');
    expect(rendered.html).toContain("background-color:var(--shiki-background)");
    expect(rendered.html).toContain("color:var(--shiki-token-keyword)");
    expect(rendered.html).toContain(">const</span>");
    expect(rendered.html).not.toMatch(/color:#[0-9a-f]{3,8}/i);
    const plain = await highlightCode("just <words>", "made-up-language");
    expect(plain).toContain('<pre class="shiki css-variables"');
    expect(plain).toContain("just &#x3C;words>");
    expect(plain).not.toContain("--shiki-token-");
  });

  it("renders the rest of the document as GitHub-flavoured HTML", async () => {
    const { html } = await renderMarkdown(GUIDE);
    expect(html).toContain("<strong>markdown</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
    expect(html).toContain('<a href="./setup.md#install">a sibling</a>');
  });

  it("rewrites only relative links through the links option with the entry slug", async () => {
    const seen: [string, string | null][] = [];
    const { html } = await renderMarkdown(GUIDE, {
      slug: "guide/start",
      links: (href, context) => {
        seen.push([href, context.slug]);
        return `/docs/${href.replace(/^\.\//, "").replace(/\.md(#|$)/, "$1")}`;
      },
    });
    expect(seen).toEqual([["./setup.md#install", "guide/start"]]);
    expect(html).toContain('<a href="/docs/setup#install">a sibling</a>');
    expect(html).toContain('<a href="https://example.com">the site</a>');
    expect(html).toContain('<a href="#install-it">a hash</a>');
  });

  it("derives the plain text of every block", async () => {
    const { text } = await renderMarkdown(GUIDE);
    expect(text).toBe(
      [
        "Getting started",
        "Rex reads markdown with code and a sibling.",
        "Install it",
        "const answer: number = 42;",
        "Install it",
        "one\ntwo",
        "A quote with the site and a hash.",
        "Café & crème?",
        "Name | Kind\nid | text",
      ].join("\n\n"),
    );
  });

  it("renders an empty document", async () => {
    expect(await renderMarkdown("")).toEqual({ source: "", html: "", headings: [], text: "" });
  });
});

describe("markdown helpers", () => {
  it("slugs headings like GitHub and numbers repeats", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
    expect(slugify("snake_case and kebab-case")).toBe("snake_case-and-kebab-case");
    expect(slugify("!!!")).toBe("section");
    const slug = headingSlugger();
    expect(["Intro", "Intro", "Intro 1", "Intro"].map(slug)).toEqual([
      "intro",
      "intro-1",
      "intro-1-1",
      "intro-2",
    ]);
  });

  it("recognises relative links and code languages", () => {
    for (const href of ["setup.md", "./setup.md", "../up.md#x", "image.png"]) {
      expect(isRelativeLink(href), href).toBe(true);
    }
    for (const href of ["", "/docs", "#top", "?q=1", "https://x.test", "mailto:a@b.c", "//cdn"]) {
      expect(isRelativeLink(href), href).toBe(false);
    }
    expect(codeLanguage("ts")).toBe("ts");
    expect(codeLanguage(" TypeScript title=x ")).toBe("typescript");
    expect(codeLanguage(undefined)).toBe(MARKDOWN_PLAIN_LANGUAGE);
    expect(codeLanguage("not-a-language")).toBe(MARKDOWN_PLAIN_LANGUAGE);
  });
});
