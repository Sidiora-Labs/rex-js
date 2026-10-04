import { readdirSync } from "node:fs";
import path from "node:path";
import { REX_ERROR_CATALOG, anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { fireEvent, waitFor, within } from "@testing-library/react";
import app, { manifest } from "rex:app";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { listDocs } from "../../../server/content/docs.ts";
import { repositoryRoot } from "../../../server/content/markdown.ts";
import { buildSearchIndex } from "../../../server/content/search.ts";

setupRexTesting({ afterEach });

const RENDER_TIMEOUT = 60_000;
const READY = { timeout: 15_000 };

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

function routesOn(dir: string, prefix: string): string[] {
  return readdirSync(path.join(repositoryRoot(), dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => `${prefix}/${path.basename(entry.name, ".md")}`)
    .sort();
}

const GUIDES = routesOn("docs", "/docs");
const RECIPES = routesOn("docs/recipes", "/docs/recipes");
const ERRORS = Object.keys(REX_ERROR_CATALOG).map((code) => `/errors/${code}`);
let API: readonly string[] = [];
let INDEXED = 0;

beforeAll(async () => {
  const [, , index] = await Promise.all([
    listDocs("guide"),
    listDocs("recipe"),
    buildSearchIndex(),
  ]);
  API = index.filter((entry) => entry.section === "API").map((entry) => entry.route);
  INDEXED = index.length;
}, RENDER_TIMEOUT);

describe("docs page", () => {
  it("declares the index at /docs, prerendered and hydrated, with the docs and search loaders", () => {
    const docs = siteApp().page("docs");
    expect(docs.route).toBe("/docs");
    expect(docs.render).toBe("ssg");
    expect(docs.chrome.title).toBe("Docs");
    expect(docs.chrome.back).toBe("home");
    expect(docs.regions).toEqual(["index", "search"]);
    expect(docs.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["docs", "list-docs"],
      ["search", "load-search-index"],
    ]);
  });

  it(
    "lists every guide and recipe by section, one link per file",
    async () => {
      const view = await renderPage(siteApp(), "docs");
      const index = await waitFor(() => {
        expect(view.sidecar().state).toBe("ready");
        const region = view.container.querySelector('[data-rex-region="docs/index"]');
        expect(region).not.toBeNull();
        return region as HTMLElement;
      }, READY);
      const section = (title: string) =>
        [...index.querySelectorAll(`[data-site-doc-list="${title}"] a[data-site-doc]`)].map(
          (link) => link.getAttribute("href"),
        );
      expect([...section("Guides")].sort()).toEqual(GUIDES);
      expect([...section("Recipes")].sort()).toEqual(RECIPES);
      expect(within(index).getByRole("heading", { level: 2, name: "Guides" })).toBeTruthy();
      expect(within(index).getByRole("heading", { level: 2, name: "Recipes" })).toBeTruthy();
      expect(
        within(index).getByRole("heading", { level: 3, name: "Ship a static page" }),
      ).toBeTruthy();
    },
    RENDER_TIMEOUT,
  );

  it(
    "searches the loaded index with the command item and filters it as the reader types",
    async () => {
      const view = await renderRegion(siteApp(), "docs", "search");
      const search = await waitFor(() => {
        expect(view.sidecar().state).toBe("ready");
        const region = view.container.querySelector('[data-rex-region="docs/search"]');
        expect(region).not.toBeNull();
        return region as HTMLElement;
      }, READY);
      const results = () =>
        [...search.querySelectorAll("[data-site-search-result]")].map((item) =>
          item.getAttribute("data-site-search-result"),
        );
      await waitFor(() => expect(results().length).toBe(INDEXED), READY);
      expect([...results()].sort()).toEqual([...GUIDES, ...RECIPES, ...ERRORS, ...API].sort());
      expect(within(search).getByText("Guides")).toBeTruthy();
      expect(within(search).getByText("Recipes")).toBeTruthy();
      expect(within(search).getByText("Errors")).toBeTruthy();
      const input = within(search).getByRole("combobox");
      fireEvent.change(input, { target: { value: "regeneration" } });
      await waitFor(() => {
        const shown = results();
        expect(shown).toContain("/docs/recipes/static-page");
        expect(shown.length).toBeLessThan(INDEXED);
      }, READY);
    },
    RENDER_TIMEOUT,
  );

  it(
    "publishes its sidecar with no actions and its loaders in the manifest",
    async () => {
      const view = await renderPage(siteApp(), "docs");
      await waitFor(() => expect(view.sidecar().state).toBe("ready"), READY);
      const sidecar = view.sidecar();
      expect(sidecar.page).toBe("docs");
      expect(sidecar.actions).toEqual([]);
      expect(sidecar.overlays).toEqual([]);
      expect(manifest.pages.find((entry) => entry.id === "docs")?.loaders).toEqual([
        { name: "docs", action: "list-docs", input: "params", invalidatedBy: [] },
        { name: "search", action: "load-search-index", input: "params", invalidatedBy: [] },
      ]);
      const link = view.container.querySelector('[data-rex-nav="docs"]');
      expect(link?.getAttribute("aria-current")).toBe("page");
    },
    RENDER_TIMEOUT,
  );
});
