import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REPOSITORY_URL,
  apiSlug,
  createSlugger,
  headingSlug,
  renderMarkdown,
  repositoryRoot,
  rewriteHref,
  siteRouteOf,
} from "./markdown.ts";

const RENDER_TIMEOUT = 60_000;

function markdownFiles(dir: string): string[] {
  return readdirSync(path.join(repositoryRoot(), dir))
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => `${dir}/${name}`)
    .sort();
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1] as string);
}

function ids(html: string): string[] {
  return [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((match) => match[1] as string);
}

describe("the repository root", () => {
  it("is the directory holding the workspace file and docs/", () => {
    const root = repositoryRoot();
    expect(readdirSync(root)).toEqual(
      expect.arrayContaining(["pnpm-workspace.yaml", "docs", "site"]),
    );
  });
});

describe("heading ids", () => {
  it("follow the GitHub anchors the docs link to", () => {
    expect(headingSlug("Upgrading from 0.1 to 0.2")).toBe("upgrading-from-01-to-02");
    expect(headingSlug("5. Fix the new checker findings")).toBe("5-fix-the-new-checker-findings");
    expect(headingSlug("REX5xx: checker and manifest")).toBe("rex5xx-checker-and-manifest");
    expect(headingSlug("rex check")).toBe("rex-check");
  });

  it("number repeated headings in document order", () => {
    const slug = createSlugger();
    expect([slug("Checks"), slug("Checks"), slug("Checks")]).toEqual([
      "checks",
      "checks-1",
      "checks-2",
    ]);
  });
});

describe("link rewriting", () => {
  it("maps docs, recipes, the API reference and the changelog to site routes", () => {
    expect(rewriteHref("errors.md#rex5xx-checker-and-manifest", "docs/convention.md")).toBe(
      "/docs/errors#rex5xx-checker-and-manifest",
    );
    expect(rewriteHref("recipes/designx.md", "docs/convention.md")).toBe("/docs/recipes/designx");
    expect(rewriteHref("loader.md", "docs/recipes/static-page.md")).toBe("/docs/recipes/loader");
    expect(rewriteHref("../cli.md#rex-build", "docs/recipes/static-page.md")).toBe(
      "/docs/cli#rex-build",
    );
    expect(rewriteHref("README.md", "docs/recipes/static-page.md")).toBe("/docs");
    expect(rewriteHref("api/README.md", "docs/reference.md")).toBe("/api");
    expect(rewriteHref("api/@sidioralabs/rex/client/media.md", "docs/reference.md")).toBe(
      "/api/sidioralabs-rex-client-media",
    );
    expect(rewriteHref("../CHANGELOG.md", "docs/versioning.md")).toBe("/changelog");
  });

  it("maps repository files and folders to their GitHub URL", () => {
    expect(rewriteHref("../examples/demo/app/data/wallet.ts", "docs/tutorial.md")).toBe(
      `${REPOSITORY_URL}/blob/main/examples/demo/app/data/wallet.ts`,
    );
    expect(rewriteHref("../examples/demo", "docs/tutorial.md")).toBe(
      `${REPOSITORY_URL}/tree/main/examples/demo`,
    );
    expect(rewriteHref("../packages/rex/src/index.ts#L1", "docs/primitives.md")).toBe(
      `${REPOSITORY_URL}/blob/main/packages/rex/src/index.ts#L1`,
    );
  });

  it("leaves external links, fragments and site paths alone", () => {
    expect(rewriteHref("https://rex.sidioralabs.com/errors/REX330", "docs/errors.md")).toBe(
      "https://rex.sidioralabs.com/errors/REX330",
    );
    expect(rewriteHref("mailto:security@sidioralabs.com", "docs/errors.md")).toBe(
      "mailto:security@sidioralabs.com",
    );
    expect(rewriteHref("#page", "docs/primitives.md")).toBe("#page");
    expect(rewriteHref("/docs/cli", "docs/primitives.md")).toBe("/docs/cli");
  });

  it("flattens API paths into dash-separated slugs", () => {
    expect(apiSlug("@sidioralabs/rex.md")).toBe("sidioralabs-rex");
    expect(apiSlug("@sidioralabs/rex/server/node.md")).toBe("sidioralabs-rex-server-node");
    expect(siteRouteOf("docs/api/@sidioralabs/rex/store/drizzle.md")).toBe(
      "/api/sidioralabs-rex-store-drizzle",
    );
    expect(siteRouteOf("packages/rex/src/index.ts")).toBeNull();
  });
});

describe("renderMarkdown", () => {
  it("titles, summarises, lists headings and highlights code", async () => {
    const source = [
      "# Sample",
      "",
      "The first paragraph links [the CLI](cli.md).",
      "",
      "## Install",
      "",
      "```sh",
      "pnpm dlx @sidioralabs/rex new my-app",
      "```",
      "",
      "### Install",
      "",
      "```",
      "plain <text>",
      "```",
    ].join("\n");
    const rendered = await renderMarkdown(source, "docs/sample.md");
    expect(rendered.title).toBe("Sample");
    expect(rendered.summary).toBe("The first paragraph links the CLI.");
    expect(rendered.headings).toEqual([
      { depth: 2, id: "install", text: "Install" },
      { depth: 3, id: "install-1", text: "Install" },
    ]);
    expect(rendered.html).toContain('<h2 id="sample">Sample</h2>');
    expect(rendered.html).toContain('<h3 id="install">Install</h3>');
    expect(rendered.html).toContain('<h4 id="install-1">Install</h4>');
    expect(rendered.html).toContain('<a href="/docs/cli">the CLI</a>');
    expect(rendered.html).toContain('class="shiki shiki-themes github-light github-dark"');
    expect(rendered.html).toContain("--shiki-light:");
    expect(rendered.html).toContain("--shiki-dark:");
    expect(rendered.html).toContain("plain &#x3C;text>");
    expect(rendered.html).not.toContain("<text>");
  });

  it("rejects a document without a level-one heading", async () => {
    await expect(renderMarkdown("No title here.", "docs/untitled.md")).rejects.toThrow(
      "docs/untitled.md has no level-one heading",
    );
  });

  it(
    "renders every doc and recipe with ids for its headings and every relative link rewritten",
    async () => {
      const files = [...markdownFiles("docs"), ...markdownFiles("docs/recipes")];
      expect(files.length).toBeGreaterThan(0);
      const routes = new Set(
        files.map((file) => siteRouteOf(file)).filter((route) => route !== null),
      );
      for (const file of files) {
        const source = readFileSync(path.join(repositoryRoot(), file), "utf8");
        const rendered = await renderMarkdown(source, file);
        expect(rendered.title, file).toBe(
          /^# (.+)$/m
            .exec(source)?.[1]
            ?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/`/g, ""),
        );
        expect(ids(rendered.html), file).toEqual(
          expect.arrayContaining(rendered.headings.map((heading) => heading.id)),
        );
        for (const href of hrefs(rendered.html)) {
          expect(href, `${file} links ${href}`).toMatch(/^(#|\/|https?:\/\/|mailto:)/);
          const route = href.split("#")[0] as string;
          if (route.startsWith("/docs/")) {
            expect(routes.has(route), `${file} links ${href}, which is not a doc`).toBe(true);
          }
        }
      }
    },
    RENDER_TIMEOUT,
  );
});
