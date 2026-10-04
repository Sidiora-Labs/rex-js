import { readdirSync } from "node:fs";
import path from "node:path";
import { anonymousActor } from "@sidioralabs/rex";
import { createTestApp, renderPage, setupRexTesting } from "@sidioralabs/rex/testing";
import { waitFor, within } from "@testing-library/react";
import app, { manifest } from "rex:app";
import { afterEach, describe, expect, it } from "vitest";
import { listApi, readApiDoc } from "../../../server/content/api.ts";
import {
  HEADING_SHIFT,
  MAX_HEADING_LEVEL,
  repositoryRoot,
} from "../../../server/content/markdown.ts";

setupRexTesting({ afterEach });

const RENDER_TIMEOUT = 120_000;
const READY = { timeout: 30_000 };
const SLUG = "sidioralabs-rex-testing";

function siteApp() {
  return createTestApp(app, { actor: anonymousActor });
}

function slugsOnDisk(): string[] {
  const api = path.join(repositoryRoot(), "docs", "api");
  return (readdirSync(api, { recursive: true }) as string[])
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) =>
      file
        .replace(/\.md$/, "")
        .split("/")
        .map((segment) => segment.replace(/^@/, ""))
        .join("-")
        .toLowerCase(),
    )
    .sort();
}

async function renderArticle() {
  await readApiDoc(SLUG);
  const view = await renderPage(siteApp(), "api-doc", {
    params: { slug: SLUG },
    pageTimeout: READY.timeout,
  });
  await waitFor(() => {
    expect(view.sidecar().state).toBe("ready");
    expect(view.container.querySelector('[data-rex-region="api-doc/toc"]')).not.toBeNull();
    expect(view.container.querySelector('[data-rex-region="api-doc/article"]')).not.toBeNull();
  }, READY);
  return view;
}

describe("api-doc page", () => {
  it(
    "declares a static page at /api/:slug whose paths are the files of docs/api",
    async () => {
      const declared = siteApp().page("api-doc");
      expect(declared.route).toBe("/api/:slug");
      expect(declared.render).toBe("static");
      expect(declared.chrome.title).toBe("API reference");
      expect(declared.chrome.back).toBe("api");
      expect(declared.regions).toEqual(["toc", "article"]);
      if (declared.paths === null) throw new Error("page api-doc declares no paths");
      const paths = await declared.paths();
      expect(paths.map((params) => (params as { readonly slug: unknown }).slug).sort()).toEqual(
        slugsOnDisk(),
      );
      expect((await listApi()).map((entry) => entry.route).sort()).toEqual(
        slugsOnDisk().map((slug) => `/api/${slug}`),
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    "renders the entry's reference through Prose with its anchors and links between API pages",
    async () => {
      const view = await renderArticle();
      const doc = await readApiDoc(SLUG);
      const article = view.container.querySelector(
        '[data-rex-region="api-doc/article"]',
      ) as HTMLElement;
      const prose = article.querySelector("article[data-rex-unsafe-html]") as HTMLElement;
      expect(prose).not.toBeNull();
      expect(
        within(prose).getByRole("heading", { level: 2, name: "@sidioralabs/rex/testing" }),
      ).toBeTruthy();
      expect(within(prose).getByRole("heading", { level: 4, name: "RexTestingError" }).id).toBe(
        "rextestingerror",
      );
      for (const heading of doc.headings) {
        const element = prose.querySelector(`[id="${heading.id}"]`);
        expect(element, heading.id).not.toBeNull();
        expect(element?.tagName, heading.id).toBe(
          `H${Math.min(heading.depth + HEADING_SHIFT, MAX_HEADING_LEVEL)}`,
        );
      }
      const hrefs = [...prose.querySelectorAll("a[href]")].map(
        (link) => link.getAttribute("href") ?? "",
      );
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toMatch(/^(#|\/api(\/|#|$)|https?:\/\/)/);
      expect(hrefs.some((href) => href.endsWith(".md"))).toBe(false);
      expect(hrefs.some((href) => href.startsWith("/api/sidioralabs-rex#"))).toBe(true);
      expect(article.querySelector("[data-site-api-entry]")?.textContent).toBe("./testing");
      expect(article.querySelector("[data-site-api-summary]")?.textContent).toBe(doc.summary);
      expect(article.querySelector("[data-site-source]")?.getAttribute("href")).toBe(
        "https://github.com/Sidiora-Labs/rex-js/blob/main/docs/api/@sidioralabs/rex/testing.md",
      );
    },
    RENDER_TIMEOUT,
  );

  it(
    "lists the entry's kinds and symbols in the table of contents",
    async () => {
      const view = await renderArticle();
      const doc = await readApiDoc(SLUG);
      const toc = view.container.querySelector('[data-rex-region="api-doc/toc"]') as HTMLElement;
      const nav = within(toc).getByRole("navigation", { name: "On this page" });
      const links = [...nav.querySelectorAll("a")].map((link) => link.getAttribute("href"));
      expect(links).toEqual(
        doc.headings.filter((heading) => heading.depth <= 3).map((heading) => `#${heading.id}`),
      );
      expect(links).toContain("#rextestingerror");
    },
    RENDER_TIMEOUT,
  );

  it(
    "publishes its sidecar with its params and no actions and its article loader in the manifest",
    async () => {
      const view = await renderArticle();
      const sidecar = view.sidecar();
      expect(sidecar.page).toBe("api-doc");
      expect(sidecar.params).toEqual({ slug: SLUG });
      expect(sidecar.actions).toEqual([]);
      expect(sidecar.overlays).toEqual([]);
      expect(manifest.pages.find((entry) => entry.id === "api-doc")?.loaders).toEqual([
        { name: "article", action: "read-api-doc", input: "mapped", invalidatedBy: [] },
      ]);
      expect(view.container.querySelector('main[data-rex-page="api-doc"]')).not.toBeNull();
      expect(view.container.querySelector('[data-rex-nav="api"]')).not.toBeNull();
    },
    RENDER_TIMEOUT,
  );
});
