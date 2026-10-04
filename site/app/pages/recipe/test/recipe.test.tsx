import { readdirSync } from "node:fs";
import path from "node:path";
import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { readDoc } from "../../../server/content/docs.ts";
import { repositoryRoot } from "../../../server/content/markdown.ts";
import declaredPage from "../page.ts";

setupRexTesting({ afterEach });

const RENDER_TIMEOUT = 60_000;
const READY = { timeout: 15_000 };
const SLUG = "static-page";

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

function slugsOn(dir: string): string[] {
  return readdirSync(path.join(repositoryRoot(), dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => path.basename(entry.name, ".md"))
    .sort();
}

async function renderArticle() {
  await readDoc("recipe", SLUG);
  const view = await renderPage(siteApp(), "recipe", { params: { slug: SLUG } });
  await waitFor(() => expect(view.sidecar().state).toBe("ready"), READY);
  return view;
}

describe("recipe page", () => {
  it(
    "declares a static page at /docs/recipes/:slug whose paths are the files of docs/recipes/",
    async () => {
      const declared = siteApp().page("recipe");
      expect(declared.route).toBe("/docs/recipes/:slug");
      expect(declared.render).toBe("static");
      expect(declared.chrome.title).toBe("Recipe");
      expect(declared.chrome.back).toBe("docs");
      expect(declared.regions).toEqual(["toc", "article"]);
      if (declared.paths === null) throw new Error("page recipe declares no paths");
      const paths = await declared.paths();
      expect(paths.map((params) => (params as { readonly slug: unknown }).slug).sort()).toEqual(
        slugsOn("docs/recipes"),
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    "renders the markdown through Prose with heading ids and rewritten links",
    async () => {
      const view = await renderArticle();
      const doc = await readDoc("recipe", SLUG);
      const article = view.container.querySelector(
        '[data-rex-region="recipe/article"]',
      ) as HTMLElement;
      const prose = article.querySelector("article[data-rex-unsafe-html]") as HTMLElement;
      expect(prose).not.toBeNull();
      expect(
        within(prose).getByRole("heading", { level: 2, name: "Ship a static page" }),
      ).toBeTruthy();
      for (const heading of doc.headings) {
        const element = prose.querySelector(`[id="${heading.id}"]`);
        expect(element, heading.id).not.toBeNull();
        expect(element?.tagName, heading.id).toBe(`H${heading.depth + 1}`);
      }
      const hrefs = [...prose.querySelectorAll("a[href]")].map(
        (link) => link.getAttribute("href") ?? "",
      );
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toMatch(/^(#|\/|https?:\/\/|mailto:)/);
      expect(hrefs.some((href) => href.endsWith(".md"))).toBe(false);
      const source = article.querySelector("[data-site-source]");
      expect(source?.getAttribute("href")).toBe(
        "https://github.com/Sidiora-Labs/rex-js/blob/main/docs/recipes/static-page.md",
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    "lists the article's sections in the table of contents",
    async () => {
      const view = await renderArticle();
      const doc = await readDoc("recipe", SLUG);
      const toc = view.container.querySelector('[data-rex-region="recipe/toc"]') as HTMLElement;
      const nav = within(toc).getByRole("navigation", { name: "On this page" });
      const links = [...nav.querySelectorAll("a")].map((link) => link.getAttribute("href"));
      expect(links).toEqual(
        doc.headings.filter((heading) => heading.depth <= 3).map((heading) => `#${heading.id}`),
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    "publishes its sidecar with its params, its article loader and no actions",
    async () => {
      const view = await renderArticle();
      const sidecar = view.sidecar();
      expect(sidecar.page).toBe("recipe");
      expect(sidecar.params).toEqual({ slug: SLUG });
      expect(sidecar.actions).toEqual([]);
      expect(sidecar.overlays).toEqual([]);
      expect(sidecar.loaders).toEqual([{ name: "article", action: "read-doc", invalidatedBy: [] }]);
      expect(view.container.querySelector('main[data-rex-page="recipe"]')).not.toBeNull();
      expect(view.container.querySelector('[data-rex-nav="docs"]')).not.toBeNull();
    },
    RENDER_TIMEOUT,
  );
});
