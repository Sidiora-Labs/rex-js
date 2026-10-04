import { readFileSync } from "node:fs";
import path from "node:path";
import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, renderRegion, setupRexTesting } from "@sidioralabs/rex/testing";
import { fireEvent, waitFor, within } from "@testing-library/react";
import app, { manifest } from "rex:app";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { listApi } from "../../../server/content/api.ts";
import { repositoryRoot } from "../../../server/content/markdown.ts";
import { API_SECTION, searchSection } from "../../../server/content/search.ts";

setupRexTesting({ afterEach });

const RENDER_TIMEOUT = 120_000;
const READY = { timeout: 30_000 };
const TESTING_ROUTE = "/api/sidioralabs-rex-testing";

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

interface PackageJson {
  readonly name: string;
  readonly version: string;
  readonly exports: Readonly<Record<string, unknown>>;
}

function packageJson(): PackageJson {
  return JSON.parse(
    readFileSync(path.join(repositoryRoot(), "packages", "rex", "package.json"), "utf8"),
  ) as PackageJson;
}

const PACKAGE = packageJson();
const EXPORTS = Object.keys(PACKAGE.exports).filter((entry) => !entry.endsWith(".json"));

beforeAll(async () => {
  await Promise.all([listApi(), searchSection(API_SECTION)]);
}, RENDER_TIMEOUT);

async function renderReady(region: string) {
  const view = await renderPage(siteApp(), "api", { pageTimeout: READY.timeout });
  const element = await waitFor(() => {
    expect(view.sidecar().state).toBe("ready");
    const found = view.container.querySelector(`[data-rex-region="api/${region}"]`);
    expect(found).not.toBeNull();
    return found as HTMLElement;
  }, READY);
  return { view, element };
}

describe("api page", () => {
  it("declares the API index at /api, prerendered and hydrated, with the entries and search loaders", () => {
    const api = siteApp().page("api");
    expect(api.route).toBe("/api");
    expect(api.render).toBe("ssg");
    expect(api.chrome.title).toBe("API");
    expect(api.chrome.back).toBe("home");
    expect(api.regions).toEqual(["entries", "search"]);
    expect(api.loaders.map((loader) => [loader.name, loader.action.id])).toEqual([
      ["entries", "list-api"],
      ["search", "load-api-search-index"],
    ]);
  });

  it(
    "lists every export path of packages/rex/package.json with its symbols grouped by kind",
    async () => {
      const { element } = await renderReady("entries");
      const listed = await listApi();
      const cards = [...element.querySelectorAll<HTMLElement>("[data-site-api-entry]")];
      expect(cards.map((card) => card.getAttribute("data-site-api-entry"))).toEqual(EXPORTS);
      expect(element.querySelector("[data-site-api-intro]")?.textContent).toContain(
        `${PACKAGE.name} ${PACKAGE.version} publishes ${EXPORTS.length} entries`,
      );
      for (const [at, card] of cards.entries()) {
        const article = listed[at];
        if (article === undefined) throw new Error(`no API page for ${EXPORTS[at]}`);
        const link = card.querySelector(`[data-site-api-link="${article.slug}"]`);
        expect(link?.getAttribute("href")).toBe(article.route);
        expect(link?.textContent).toBe(article.title);
        expect(within(card).getByRole("heading", { level: 3, name: article.title })).toBeTruthy();
        const kinds = [...card.querySelectorAll("[data-site-api-kind]")].map((kind) =>
          kind.getAttribute("data-site-api-kind"),
        );
        expect(kinds).toEqual(article.kinds.map((kind) => kind.title));
        const symbols = [...card.querySelectorAll("a[data-site-api-symbol]")].map((symbol) =>
          symbol.getAttribute("href"),
        );
        expect(symbols).toEqual(
          article.kinds.flatMap((kind) =>
            kind.symbols.map((symbol) => `${article.route}#${symbol.id}`),
          ),
        );
      }
      const testing = cards.find(
        (card) => card.getAttribute("data-site-api-entry") === "./testing",
      );
      expect(
        testing?.querySelector('[data-site-api-symbol="RexTestingError"]')?.getAttribute("href"),
      ).toBe(`${TESTING_ROUTE}#rextestingerror`);
    },
    RENDER_TIMEOUT,
  );

  it(
    "searches the API part of the index and opens the chosen entry through its page",
    async () => {
      const view = await renderRegion(
        siteApp(),
        "api",
        "search",
        {},
        { pageTimeout: READY.timeout },
      );
      const search = await waitFor(() => {
        expect(view.sidecar().state).toBe("ready");
        const region = view.container.querySelector('[data-rex-region="api/search"]');
        expect(region).not.toBeNull();
        return region as HTMLElement;
      }, READY);
      const section = await searchSection(API_SECTION);
      const results = () =>
        [...search.querySelectorAll("[data-site-api-search-result]")].map((item) =>
          item.getAttribute("data-site-api-search-result"),
        );
      await waitFor(() => expect(results().length).toBe(section.length), READY);
      expect([...results()].sort()).toEqual(section.map((entry) => entry.route).sort());
      expect(results().every((route) => route?.startsWith("/api/"))).toBe(true);
      const input = within(search).getByRole("combobox");
      fireEvent.change(input, { target: { value: "RexTestingError" } });
      await waitFor(() => {
        const shown = results();
        expect(shown).toContain(TESTING_ROUTE);
        expect(shown.length).toBeLessThan(section.length);
      }, READY);
      const item = search.querySelector(`[data-site-api-search-result="${TESTING_ROUTE}"]`);
      fireEvent.click(item as HTMLElement);
      await waitFor(() => expect(view.history.at(-1)).toBe(TESTING_ROUTE), READY);
    },
    RENDER_TIMEOUT,
  );

  it(
    "publishes its sidecar with no actions and its loaders in the manifest",
    async () => {
      const { view } = await renderReady("search");
      const sidecar = view.sidecar();
      expect(sidecar.page).toBe("api");
      expect(sidecar.actions).toEqual([]);
      expect(sidecar.overlays).toEqual([]);
      expect(manifest.pages.find((entry) => entry.id === "api")?.loaders).toEqual([
        { name: "entries", action: "list-api", input: "params", invalidatedBy: [] },
        { name: "search", action: "load-api-search-index", input: "params", invalidatedBy: [] },
      ]);
      expect(view.container.querySelector('main[data-rex-page="api"]')).not.toBeNull();
      const link = view.container.querySelector('[data-rex-nav="api"]');
      expect(link?.getAttribute("aria-current")).toBe("page");
    },
    RENDER_TIMEOUT,
  );
});
