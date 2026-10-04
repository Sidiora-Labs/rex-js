import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { REX_ERROR_CATALOG } from "@sidioralabs/rex";
import { describe, expect, it } from "vitest";
import { docFiles, docSlugs, listDocs, readDoc, readingOrder, searchEntries } from "./docs.ts";
import { REPOSITORY_URL, repositoryRoot } from "./markdown.ts";
import { API_SECTION, buildSearchIndex, searchSection } from "./search.ts";

const RENDER_TIMEOUT = 60_000;

function filesOn(dir: string): string[] {
  return readdirSync(path.join(repositoryRoot(), dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

describe("the docs reader", () => {
  it("lists every guide and recipe file except the README files", () => {
    expect(docFiles("guide")).toEqual(filesOn("docs"));
    expect(docFiles("recipe")).toEqual(filesOn("docs/recipes"));
    expect(docSlugs("guide")).toEqual(filesOn("docs").map((file) => path.basename(file, ".md")));
    expect(docSlugs("recipe")).toContain("static-page");
    expect(docSlugs("guide")).not.toContain("README");
  });

  it("orders guides by the README documentation list and recipes by the recipes table", () => {
    const guides = readingOrder("guide");
    expect([...guides].sort()).toEqual(filesOn("docs"));
    expect(guides.slice(0, 3)).toEqual([
      "docs/convention.md",
      "docs/agent-contract.md",
      "docs/primitives.md",
    ]);
    const recipes = readingOrder("recipe");
    expect([...recipes].sort()).toEqual(filesOn("docs/recipes"));
    expect(recipes[0]).toBe("docs/recipes/loader.md");
    const table = readFileSync(path.join(repositoryRoot(), "docs/recipes/README.md"), "utf8");
    const linked = [...table.matchAll(/\]\(([a-z0-9-]+\.md)\)/g)].map(
      (match) => `docs/recipes/${match[1] as string}`,
    );
    expect(recipes.slice(0, linked.length)).toEqual(linked);
  });

  it(
    "reads a guide with its title, route, source, headings and rendered HTML",
    async () => {
      const doc = await readDoc("guide", "convention");
      expect(doc.title).toBe("The Rex convention");
      expect(doc.route).toBe("/docs/convention");
      expect(doc.file).toBe("docs/convention.md");
      expect(doc.source).toBe(`${REPOSITORY_URL}/blob/main/docs/convention.md`);
      expect(doc.summary).toMatch(/^A Rex app is a directory with an app\/ folder/);
      expect(doc.headings).toEqual(
        expect.arrayContaining([
          { depth: 2, id: "import-table", text: "Import table" },
          { depth: 2, id: "the-screen-fit-contract", text: "The screen-fit contract" },
        ]),
      );
      expect(doc.html).toContain('href="/docs/recipes/designx"');
      expect(doc.html).toContain('href="/docs/errors#rex5xx-checker-and-manifest"');
    },
    RENDER_TIMEOUT,
  );

  it(
    "reads a recipe under its recipe route",
    async () => {
      const recipe = await readDoc("recipe", "static-page");
      expect(recipe.title).toBe("Ship a static page");
      expect(recipe.route).toBe("/docs/recipes/static-page");
      expect(recipe.headings.map((heading) => heading.id)).toEqual([
        "a-static-page",
        "a-prerendered-page-with-regeneration",
        "build-and-serve",
        "navigation-on-a-static-host",
        "checks",
      ]);
      expect(recipe.html).toContain('href="/docs/cli#rex-build"');
      expect(recipe.html).toContain('href="/docs/recipes/loader"');
    },
    RENDER_TIMEOUT,
  );

  it("refuses a slug that is not a file", () => {
    expect(() => readDoc("guide", "no-such-doc")).toThrow('no guide "no-such-doc" under docs/');
    expect(() => readDoc("recipe", "convention")).toThrow(
      'no recipe "convention" under docs/recipes/',
    );
  });

  it(
    "lists every doc once in reading order",
    async () => {
      const guides = await listDocs("guide");
      expect(guides.map((doc) => doc.file)).toEqual(readingOrder("guide"));
      const recipes = await listDocs("recipe");
      expect(recipes.map((doc) => doc.route)).toEqual(
        readingOrder("recipe").map((file) => `/docs/recipes/${path.basename(file, ".md")}`),
      );
    },
    RENDER_TIMEOUT,
  );
});

describe("the search index", () => {
  it(
    "holds every guide, recipe and error code with its section, headings and summary",
    async () => {
      const expected = [
        ...filesOn("docs").map((file) => `/docs/${path.basename(file, ".md")}`),
        ...filesOn("docs/recipes").map((file) => `/docs/recipes/${path.basename(file, ".md")}`),
      ].sort();
      const own = await searchEntries();
      expect(own.map((entry) => entry.route).sort()).toEqual(expected);
      const index = await buildSearchIndex();
      expect(index.map((entry) => entry.route)).toEqual(expect.arrayContaining(expected));
      const loader = index.find((entry) => entry.route === "/docs/recipes/loader");
      expect(loader).toMatchObject({ section: "Recipes", title: "Load page data with a loader" });
      expect(loader?.headings).toContain("2. Declare the loader on the page");
      expect(loader?.summary).toMatch(/^A page declares the data it needs/);
      const convention = index.find((entry) => entry.route === "/docs/convention");
      expect(convention?.section).toBe("Guides");
      const errors = Object.keys(REX_ERROR_CATALOG).map((code) => `/errors/${code}`);
      const api = (await searchSection(API_SECTION)).map((entry) => entry.route);
      expect(api.length).toBeGreaterThan(0);
      expect(index.map((entry) => entry.route).sort()).toEqual(
        [...expected, ...errors, ...api].sort(),
      );
      const rex209 = index.find((entry) => entry.route === "/errors/REX209");
      expect(rex209?.section).toBe("Errors");
      expect(rex209?.title.startsWith("REX209 ")).toBe(true);
    },
    RENDER_TIMEOUT,
  );
});
