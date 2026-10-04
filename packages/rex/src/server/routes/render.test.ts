import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import type { RexEntryBundle } from "../../client/entry.tsx";
import { SSR_ATTRIBUTE } from "../../client/hydrate.ts";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../../client/page.tsx";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page, type AnyPage } from "../../core/page.ts";
import { always, never } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { STATE_EXPORT_NAMES } from "../../core/states.ts";
import { buildManifest } from "../../manifest/build.ts";
import { text } from "../../schema/index.ts";
import {
  STATIC_HEADER,
  createStaticCache,
  memoryStaticStore,
  registerStaticCache,
} from "../adapters/static-cache.ts";
import { createRexServer } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { DENSITY_HEADER } from "../context.ts";
import { CSRF_COOKIE } from "../form.ts";
import {
  RENDER_STATUS as EXPORTED_RENDER_STATUS,
  installRenderRoute as exportedInstallRenderRoute,
  isDocumentPath as exportedIsDocumentPath,
  pageRendererFor as exportedPageRendererFor,
  registerPageRenderer as exportedRegisterPageRenderer,
} from "../index.ts";
import { REX_ROUTES } from "../routes.ts";
import { createRexRenderer, screenFromRequest } from "../ssr.ts";
import {
  HTML_CONTENT_TYPE,
  RENDER_KIND_HEADER,
  RENDER_PAGE_HEADER,
  RENDER_STATUS,
  REX_PATH_PREFIX,
  installRenderRoute,
  isDocumentPath,
  pageRendererFor,
  registerPageRenderer,
} from "./render.ts";

const APP = "render-route";
const DENSITY_MESSAGE = 'REX321 x-rex-density must be one of default, agent, received "compact"';

const brokenFeed = action("broken-feed", {
  input: z.object({}),
  output: z.object({ items: z.array(text()) }),
  policy: always(),
  effect: "read",
  handler: () => {
    throw new Error("the feed store is down");
  },
});

const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: text({ min: 1 }) }),
  chrome: { title: "Portfolio" },
});

const vault = page("vault", { route: "/vault", policy: never(), chrome: { title: "Vault" } });

const feed = page("feed", { route: "/feed", load: { feed: brokenFeed }, chrome: { title: "Feed" } });

const alice = actor({ id: "alice" });

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.values(STATE_EXPORT_NAMES).map((name) => [
      name,
      () => createElement("p", null, `${label}: ${name}`),
    ]),
  );
}

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => Promise.resolve(loaded),
  });
}

const PortfolioView = view<{ account: string }>(({ params }) =>
  createElement("p", null, `Holdings of ${params.account}`),
);
const VaultView = view(() => createElement("p", null, "Vault contents"));
const FeedView = view(() => createElement("p", null, "Feed items"));

function renderedApp() {
  const registry = createRegistry().register(brokenFeed, portfolio, vault, feed).freeze();
  const bundle: RexEntryBundle = {
    registry,
    manifest: buildManifest(registry, { app: APP }),
    pages: [
      lazySet(portfolio, { view: PortfolioView, states: statesFor("Portfolio") }),
      lazySet(vault, { view: VaultView, states: statesFor("Vault") }),
      lazySet(feed, { view: FeedView, states: statesFor("Feed") }),
    ],
  };
  const renderer = createRexRenderer({ bundle });
  registerPageRenderer(registry, renderer);
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => alice, app: APP });
  return { registry, renderer, server, ledger };
}

function csrfCookieOf(response: Response): string | undefined {
  return response.headers
    .getSetCookie()
    .find((line) => line.startsWith(`${CSRF_COOKIE}=`));
}

describe("isDocumentPath", () => {
  it("treats extension-free paths outside /rex as documents", () => {
    expect(REX_PATH_PREFIX).toBe("/rex");
    expect(exportedIsDocumentPath).toBe(isDocumentPath);
    for (const path of ["/", "/portfolio/acc-1", "/portfolio/acc-1/", "/docs/v1.2/guide", "/rexy"]) {
      expect(isDocumentPath(path), path).toBe(true);
    }
    for (const path of ["/rex", "/rex/", "/rex/manifest", "/rex/pages/notes.md", "/assets/app.js", "/favicon.ico", "/docs/guide.html"]) {
      expect(isDocumentPath(path), path).toBe(false);
    }
  });
});

describe("registerPageRenderer", () => {
  it("validates the registry and renderer and unregisters only its own registration", () => {
    expect(exportedRegisterPageRenderer).toBe(registerPageRenderer);
    expect(exportedPageRendererFor).toBe(pageRendererFor);
    const registry = createRegistry().register(portfolio).freeze();
    const bundle: RexEntryBundle = {
      registry,
      manifest: buildManifest(registry, { app: APP }),
      pages: [lazySet(portfolio, { view: PortfolioView, states: statesFor("Portfolio") })],
    };
    const first = createRexRenderer({ bundle });
    const second = createRexRenderer({ bundle });
    expect(first).not.toBe(second);
    expect(() => registerPageRenderer(null as unknown as object, first)).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX400" }),
    );
    expect(() => registerPageRenderer(registry, {} as never)).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX400" }),
    );
    expect(pageRendererFor(registry)).toBeUndefined();
    const unregisterFirst = registerPageRenderer(registry, first);
    expect(pageRendererFor(registry)).toBe(first);
    const unregisterSecond = registerPageRenderer(registry, second);
    expect(pageRendererFor(registry)).toBe(second);
    unregisterFirst();
    expect(pageRendererFor(registry)).toBe(second);
    unregisterSecond();
    expect(pageRendererFor(registry)).toBeUndefined();
  });
});

describe("installRenderRoute", () => {
  it("is the catch-all route createRexServer mounts before the pages text route", () => {
    expect(exportedInstallRenderRoute).toBe(installRenderRoute);
    expect(EXPORTED_RENDER_STATUS).toBe(RENDER_STATUS);
    expect(RENDER_STATUS).toEqual({ page: 200, denied: 403, "not-found": 404, failed: 500 });
    expect(Object.isFrozen(RENDER_STATUS)).toBe(true);
    expect(REX_ROUTES.indexOf(installRenderRoute)).toBe(REX_ROUTES.length - 2);
    expect(HTML_CONTENT_TYPE).toBe("text/html; charset=utf-8");
    expect(RENDER_KIND_HEADER).toBe("x-rex-render");
    expect(RENDER_PAGE_HEADER).toBe("x-rex-page");
  });

  it("maps every render kind to its status and headers and issues the CSRF cookie once", async () => {
    const { server } = renderedApp();
    const rendered = await server.request("/portfolio/acc-1", { headers: { accept: "text/html" } });
    expect(rendered.status).toBe(RENDER_STATUS.page);
    expect(rendered.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);
    expect(rendered.headers.get("cache-control")).toBe("no-store");
    expect(rendered.headers.get(RENDER_KIND_HEADER)).toBe("page");
    expect(rendered.headers.get(RENDER_PAGE_HEADER)).toBe("portfolio");
    expect(rendered.headers.get(DENSITY_HEADER)).toBe("default");
    const cookie = csrfCookieOf(rendered);
    const token = new RegExp(`^${CSRF_COOKIE}=([0-9a-f]{64});`).exec(cookie ?? "")?.[1];
    expect(token).toBeDefined();
    const html = await rendered.text();
    expect(html).toContain(SSR_ATTRIBUTE);
    expect(html).toContain("Holdings of acc-1");
    const again = await server.request("/portfolio/acc-1", {
      headers: { accept: "text/html", cookie: `${CSRF_COOKIE}=${token as string}` },
    });
    expect(again.status).toBe(RENDER_STATUS.page);
    expect(csrfCookieOf(again)).toBeUndefined();

    const denied = await server.request("/vault");
    expect(denied.status).toBe(RENDER_STATUS.denied);
    expect(denied.headers.get(RENDER_KIND_HEADER)).toBe("denied");
    expect(denied.headers.get(RENDER_PAGE_HEADER)).toBe("vault");
    expect(denied.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);

    const failed = await server.request("/feed");
    expect(failed.status).toBe(RENDER_STATUS.failed);
    expect(failed.headers.get(RENDER_KIND_HEADER)).toBe("failed");
    expect(failed.headers.get(RENDER_PAGE_HEADER)).toBe("feed");
    expect(failed.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);

    const missing = await server.request("/nowhere");
    expect(missing.status).toBe(RENDER_STATUS["not-found"]);
    expect(missing.headers.get(RENDER_KIND_HEADER)).toBe("not-found");
    expect(missing.headers.has(RENDER_PAGE_HEADER)).toBe(false);
    expect(missing.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);
    expect(await missing.text()).toContain(SSR_ATTRIBUTE);
  });

  it("passes the density header through and refuses an unknown one with 400 JSON", async () => {
    const { server } = renderedApp();
    const agent = await server.request("/portfolio/acc-1", {
      headers: { [DENSITY_HEADER]: "agent" },
    });
    expect(agent.status).toBe(RENDER_STATUS.page);
    expect(agent.headers.get(DENSITY_HEADER)).toBe("agent");
    const invalid = await server.request("/portfolio/acc-1", {
      headers: { [DENSITY_HEADER]: "compact" },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("content-type")).toContain("application/json");
    expect(await invalid.json()).toEqual({ code: "BAD_REQUEST", message: DENSITY_MESSAGE });
    expect(invalid.headers.has(RENDER_KIND_HEADER)).toBe(false);
  });

  it("leaves non-document paths and apps without a renderer to the following handlers", async () => {
    const { server } = renderedApp();
    const asset = await server.request("/assets/app.js");
    expect(asset.status).toBe(404);
    expect(asset.headers.has(RENDER_KIND_HEADER)).toBe(false);
    const api = await server.request("/rex/nothing");
    expect(api.status).toBe(404);
    expect(api.headers.has(RENDER_KIND_HEADER)).toBe(false);
    const registry = createRegistry().register(portfolio).freeze();
    const plain = createRexServer({ registry, ledger: memoryLedger(), actor: () => alice, app: APP });
    const unrendered = await plain.request("/portfolio/acc-1");
    expect(unrendered.status).toBe(404);
    expect(unrendered.headers.has(RENDER_KIND_HEADER)).toBe(false);
    expect(unrendered.headers.get("content-type")).not.toBe(HTML_CONTENT_TYPE);
    expect(csrfCookieOf(unrendered)).toBeUndefined();
  });

  it("serves a registered static cache entry, even without a renderer, and still skips the rest", async () => {
    const registry = createRegistry().register(portfolio).freeze();
    const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => alice, app: APP });
    const html =
      '<!doctype html><html lang="en"><head><title>Landing</title></head><body><main data-rex-page="landing">Join the list</main></body></html>';
    const cache = createStaticCache({
      pages: [
        {
          path: "/landing",
          page: "landing",
          render: "static",
          revalidate: null,
          file: "landing/index.html",
          generatedAt: Date.now(),
        },
      ],
      store: memoryStaticStore([["/landing", html]]),
      screen: screenFromRequest,
    });
    const unregister = registerStaticCache(registry, cache);
    try {
      const hit = await server.request("/landing/", { headers: { accept: "text/html" } });
      expect(hit.status).toBe(RENDER_STATUS.page);
      expect(hit.headers.get(STATIC_HEADER)).toBe("hit");
      expect(hit.headers.get(RENDER_KIND_HEADER)).toBe("page");
      expect(hit.headers.get(RENDER_PAGE_HEADER)).toBe("landing");
      expect(hit.headers.get(DENSITY_HEADER)).toBe("default");
      expect(hit.headers.get("content-type")).toBe(HTML_CONTENT_TYPE);
      expect(hit.headers.get("cache-control")).toBe("no-store");
      expect(hit.headers.getSetCookie()).toEqual([]);
      const body = await hit.text();
      expect(body).toContain(
        '<html lang="en" data-rex-screen="desktop" data-rex-pointer="fine" data-rex-density="comfortable">',
      );
      expect(body).toContain('<main data-rex-page="landing">Join the list</main>');
      const unrendered = await server.request("/portfolio/acc-1");
      expect(unrendered.status).toBe(404);
      expect(unrendered.headers.has(RENDER_KIND_HEADER)).toBe(false);
    } finally {
      unregister();
    }
    const gone = await server.request("/landing");
    expect(gone.status).toBe(404);
    expect(gone.headers.has(STATIC_HEADER)).toBe(false);
  });
});
