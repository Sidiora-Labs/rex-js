import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ROOT_ENTRY,
  anchorHeadings,
  apiFiles,
  apiPackage,
  apiSearchEntries,
  articleSource,
  entryOf,
  kindsSummary,
  listApi,
  readApiDoc,
  type ApiArticle,
} from "./api.ts";
import { repositoryRoot } from "./markdown.ts";
import { API_SECTION, buildSearchIndex, searchSection } from "./search.ts";

const RENDER_TIMEOUT = 120_000;
const EXTERNAL = /^https?:\/\//;
const API_LINK = /^\/api(?:\/([a-z0-9-]+))?(?:#(.+))?$/;

function filesOnDisk(): string[] {
  const root = repositoryRoot();
  return (readdirSync(path.join(root, "docs", "api"), { recursive: true }) as string[])
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => `docs/api/${file}`)
    .sort();
}

function packageExports(): string[] {
  const manifest = JSON.parse(
    readFileSync(path.join(repositoryRoot(), "packages", "rex", "package.json"), "utf8"),
  ) as { readonly exports: Readonly<Record<string, unknown>> };
  return Object.keys(manifest.exports).filter((entry) => !entry.endsWith(".json"));
}

function idsOf(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] as string);
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/\shref="([^"]*)"/g)].map((match) => match[1] as string);
}

const articles = new Map<string, ApiArticle>();

beforeAll(async () => {
  for (const summary of await listApi()) {
    articles.set(summary.slug, await readApiDoc(summary.slug));
  }
}, RENDER_TIMEOUT);

describe("api reader", () => {
  it("lists every markdown file under docs/api except its README, one dash-separated slug each", () => {
    const files = apiFiles();
    expect([...files]).toEqual(filesOnDisk());
    const slugs = [...articles.keys()];
    expect(slugs).toHaveLength(files.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(articles.get("sidioralabs-rex-client-i18n")?.file).toBe(
      "docs/api/@sidioralabs/rex/client/i18n.md",
    );
    expect(articles.get("sidioralabs-rex-manifest-1")?.title).toBe("@sidioralabs/rex/manifest");
  });

  it("maps every page to one export path of packages/rex/package.json, in the package's order", async () => {
    const exports = packageExports();
    expect([...apiPackage().entries]).toEqual(exports);
    const listed = await listApi();
    expect(listed.map((article) => article.entry)).toEqual(exports);
    expect(listed.find((article) => article.entry === ROOT_ENTRY)?.title).toBe("@sidioralabs/rex");
    expect(entryOf("@sidioralabs/rex/store/drizzle", "@sidioralabs/rex")).toBe("./store/drizzle");
    expect(() => entryOf("react", "@sidioralabs/rex")).toThrow(/not a module/);
  });

  it("renders each page with unique ids, the typedoc anchors kept on their headings and the toc ids present", () => {
    for (const article of articles.values()) {
      const ids = idsOf(article.html);
      expect(new Set(ids).size, article.slug).toBe(ids.length);
      expect(article.html, article.slug).not.toMatch(/<a id="/);
      for (const heading of article.headings) {
        expect(ids, `${article.slug}#${heading.id}`).toContain(heading.id);
      }
    }
    const testing = articles.get("sidioralabs-rex-testing");
    expect(testing?.html).toContain('<h4 id="rextestingerror">RexTestingError</h4>');
    expect(testing?.html).not.toContain("@sidioralabs/rex API</a>");
  });

  it("points every link in a rendered API page at an existing slug and anchor or an external URL", () => {
    let checked = 0;
    for (const article of articles.values()) {
      for (const href of hrefsOf(article.html)) {
        checked += 1;
        if (EXTERNAL.test(href)) continue;
        if (href.startsWith("#")) {
          expect(idsOf(article.html), `${article.slug} ${href}`).toContain(href.slice(1));
          continue;
        }
        const match = API_LINK.exec(href);
        expect(match, `${article.slug} ${href}`).not.toBeNull();
        const slug = match?.[1];
        const hash = match?.[2];
        if (slug === undefined) continue;
        const target = articles.get(slug);
        expect(target, `${article.slug} ${href}`).toBeDefined();
        if (hash !== undefined && target !== undefined) {
          expect(idsOf(target.html), `${article.slug} ${href}`).toContain(hash);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("groups each page's symbols by kind from its headings", () => {
    const testing = articles.get("sidioralabs-rex-testing");
    if (testing === undefined) throw new Error("no testing page");
    expect(testing.kinds.map((kind) => kind.title)).toEqual(
      testing.headings.filter((heading) => heading.depth === 2).map((heading) => heading.text),
    );
    const symbols = testing.kinds.flatMap((kind) => kind.symbols);
    expect(symbols.map((symbol) => symbol.id)).toEqual(
      testing.headings.filter((heading) => heading.depth === 3).map((heading) => heading.id),
    );
    expect(testing.kinds.find((kind) => kind.title === "Classes")?.symbols).toEqual([
      { name: "RexTestingError", id: "rextestingerror" },
    ]);
    expect(testing.summary).toBe(kindsSummary("./testing", testing.kinds));
    expect(testing.summary).toMatch(/^The \.\/testing entry exports \d+ symbols: 1 class, /);
  });

  it("drops the breadcrumb above the title and gives unanchored headings ids no anchor uses", () => {
    expect(articleSource("[Index](../README.md) / x\n\n# x\n\nBody\n", "x.md")).toBe(
      "# x\n\nBody\n",
    );
    expect(() => articleSource("no title\n", "x.md")).toThrow(/no level-one heading/);
    const anchored = anchorHeadings(
      '<h2 id="x">x</h2>\n<p><a id="code"></a></p>\n<h3 id="code">code</h3>\n<h4 id="code-1">code</h4>\n',
      "x",
      [
        { depth: 2, id: "code", text: "code" },
        { depth: 3, id: "code-1", text: "code" },
      ],
      "x.md",
    );
    expect(anchored.html).toBe(
      '<h2 id="x">x</h2>\n<h3 id="code">code</h3>\n<h4 id="code-1">code</h4>\n',
    );
    expect(anchored.headings.map((heading) => heading.id)).toEqual(["code", "code-1"]);
  });

  it(
    "exposes one search entry per API page in the API section of the shared index",
    async () => {
      const entries = await apiSearchEntries();
      expect(entries.map((entry) => entry.route).sort()).toEqual(
        [...articles.values()].map((article) => article.route).sort(),
      );
      const section = await searchSection(API_SECTION);
      expect(section.map((entry) => entry.route)).toEqual(entries.map((entry) => entry.route));
      expect(section.every((entry) => entry.section === API_SECTION)).toBe(true);
      const index = await buildSearchIndex();
      expect(index.filter((entry) => entry.route.startsWith("/api/"))).toEqual(section);
      const testing = section.find((entry) => entry.route === "/api/sidioralabs-rex-testing");
      expect(testing?.headings).toContain("RexTestingError");
    },
    RENDER_TIMEOUT,
  );
});
