import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fragment, createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RexEntryBundle } from "../client/entry.tsx";
import { ActionForm } from "../client/form.tsx";
import { region, view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { anonymousActor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { SIDECAR_MIME_TYPE } from "../manifest/sidecar.schema.ts";
import { prerenderPages, writePrerenderList } from "../vite/prerender.ts";
import { escapeInlineJson } from "../core/serialize.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_NONCE,
  PRERENDER_SCREEN,
  RexStaticPageError,
  STATIC_HEADER,
  applyScreenAttributes,
  createStaticCache,
  prerenderContext,
  fillCsrfToken,
  memoryStaticStore,
  normalizePagePath,
  parsePrerenderList,
  prerenderedFile,
  registerStaticCache,
  type PrerenderList,
  type StaticCache,
} from "./adapters/static-cache.ts";
import { createRexServer } from "./app.ts";
import { memoryLedger } from "./audit.ts";
import { CSRF_COOKIE } from "./form.ts";
import {
  installNodeStaticPages,
  startPrerenderedNodeServer,
  type RunningNodeServer,
} from "./node.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "./routes/render.ts";
import {
  createRexRenderer,
  pageRenderMode,
  registerPageRenderer,
  screenFromRequest,
  type RexDocumentAssets,
} from "./ssr.ts";

const APP = "static-cache-fixture";
const signups: string[] = [];
let headline = "Morning edition";
let failNews = false;

const signUp = action("sign-up", {
  input: z.object({ email: text({ min: 3, max: 120 }) }),
  output: z.object({ email: text() }),
  policy: always(),
  effect: "reversible",
  label: "Sign up",
  handler: (input) => {
    signups.push(input.email);
    return { email: input.email };
  },
});

const landing = page("landing", {
  route: "/landing",
  render: "static",
  actions: [signUp],
  chrome: { title: "Landing" },
  regions: ["signup"],
});

const news = page("news", {
  route: "/news",
  render: "ssg",
  revalidate: 1,
  chrome: { title: "News" },
  regions: ["headline"],
});

const story = page("story", {
  route: "/stories/:slug",
  params: z.object({ slug: text({ min: 1, max: 40 }) }),
  render: "ssg",
  paths: () => [{ slug: "launch" }],
  chrome: { title: "Story" },
});

const live = page("live", {
  route: "/live",
  chrome: { title: "Live" },
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return {
    Loading: () => createElement("p", null, `${label} is loading`),
    Empty: () => createElement("p", null, `${label} is empty`),
    Stale: () => createElement("p", null, `${label} may be stale`),
    Partial: () => createElement("p", null, `${label} is partial`),
    Offline: () => createElement("p", null, `${label} is offline`),
    PermissionDenied: () => createElement("p", null, `You cannot open ${label}`),
    RecoverableError: () => createElement("p", null, `${label} failed`),
    TerminalError: () => createElement("p", null, `${label} is unavailable`),
  };
}

const LandingSignup = region("signup", () => createElement(ActionForm, { action: signUp }));
const LandingView = view(() =>
  createElement(
    Fragment,
    null,
    createElement("h1", null, "Join the list"),
    createElement(LandingSignup),
  ),
);

const NewsHeadline = region("headline", () => {
  if (failNews) throw new Error("the news feed is down");
  return createElement("p", { "data-headline": "" }, headline);
});
const NewsView = view(() => createElement(NewsHeadline));

const StoryView = view<{ slug: string }>(({ params }) =>
  createElement("h1", null, `Story ${params.slug}`),
);
const LiveView = view(() => createElement("p", null, "Live ticker"));

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  let loading: Promise<LoadedPageModules> | null = null;
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => {
      loading ??= Promise.resolve().then(() => loaded);
      return loading;
    },
  });
}

const registry = createRegistry().register(signUp, landing, news, story, live).freeze();
const manifest = buildManifest(registry, { app: APP });
const bundle: RexEntryBundle = {
  registry,
  manifest,
  pages: [
    lazySet(landing, {
      view: LandingView,
      states: statesFor("Landing"),
      regions: { signup: LandingSignup },
      overlays: {},
    }),
    lazySet(news, {
      view: NewsView,
      states: statesFor("News"),
      regions: { headline: NewsHeadline },
      overlays: {},
    }),
    lazySet(story, { view: StoryView, states: statesFor("Story") }),
    lazySet(live, { view: LiveView, states: statesFor("Live") }),
  ],
};

const ENTRY_SCRIPT = "/assets/entry-a1.js";
const ENTRY_SHEET = "/assets/entry-a1.css";
const assets: RexDocumentAssets = {
  scripts: [ENTRY_SCRIPT],
  stylesheets: [ENTRY_SHEET],
  preloads: [],
  pages: {
    landing: { stylesheets: [], preloads: ["/assets/page-landing-b2.js"] },
    news: { stylesheets: [], preloads: ["/assets/page-news-c3.js"] },
  },
};
const ENTRY_SOURCE = "console.log('rex entry');\n";
const SPA_SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

const ledger = memoryLedger();
const server = createRexServer({ registry, ledger, actor: () => anonymousActor, app: APP });
const renderer = createRexRenderer({ bundle, assets });
registerPageRenderer(registry, renderer);

const outDir = mkdtempSync(join(tmpdir(), "rex-static-cache-"));
const clientDir = join(outDir, "client");
const regenerationErrors: unknown[] = [];
let list: PrerenderList;
let cache: StaticCache;
let running: RunningNodeServer;

beforeAll(async () => {
  mkdirSync(join(clientDir, "assets"), { recursive: true });
  writeFileSync(join(clientDir, "index.html"), SPA_SHELL);
  writeFileSync(join(clientDir, "assets", "entry-a1.js"), ENTRY_SOURCE);
  writeFileSync(join(clientDir, "assets", "entry-a1.css"), "body { margin: 0; }\n");
  list = await prerenderPages(
    { bundle, ssr: { createRexRenderer, pageRenderMode }, assets },
    { clientDir },
  );
  const listFile = writePrerenderList(outDir, list);
  cache = await installNodeStaticPages(registry, {
    clientDir,
    list: listFile,
    onError: (error) => {
      regenerationErrors.push(error);
    },
  });
  running = await startPrerenderedNodeServer(server, {
    port: 0,
    clientDir,
    hostname: "127.0.0.1",
    registry,
  });
}, 60_000);

afterAll(async () => {
  await running?.close();
  rmSync(outDir, { recursive: true, force: true });
});

function get(path: string, headers: Readonly<Record<string, string>> = {}): Promise<Response> {
  return fetch(`${running.url}${path}`, { headers: { accept: "text/html", ...headers } });
}

function executableScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((match) => match[1] as string)
    .filter((attributes) => {
      const type = /\btype="([^"]*)"/.exec(attributes)?.[1];
      return type === undefined || type === "module" || type === "text/javascript";
    });
}

function rootTag(html: string): string {
  return /<html\b[^>]*>/.exec(html)?.[0] ?? "";
}

function rootAttributes(html: string): Record<string, string> {
  const tag = rootTag(html);
  const found: Record<string, string> = {};
  for (const name of ["data-rex-screen", "data-rex-pointer", "data-rex-density"]) {
    const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
    if (value !== undefined) found[name] = value;
  }
  return found;
}

function sidecarOf(html: string): Record<string, unknown> {
  const found = new RegExp(
    `<script type="${SIDECAR_MIME_TYPE.replace("+", "\\+")}"[^>]*>([\\s\\S]*?)</script>`,
  ).exec(html);
  if (found === null) throw new Error("the page has no sidecar");
  return JSON.parse(found[1] as string) as Record<string, unknown>;
}

const PHONE_HINTS = {
  "sec-ch-ua-mobile": "?1",
  "sec-ch-viewport-width": "390",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
} as const;
const TABLET_AGENT =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

function csrfCookieOf(response: Response): string | null {
  const header = response.headers.get("set-cookie") ?? "";
  return new RegExp(`${CSRF_COOKIE}=([0-9a-f]{64})`).exec(header)?.[1] ?? null;
}

function csrfFieldOf(html: string): string | null {
  return /<input[^>]*name="_csrf"[^>]*value="([^"]*)"/.exec(html)?.[1] ?? null;
}

async function waitPastWindow(path: string): Promise<void> {
  const entry = cache.entry(path);
  if (entry === undefined || entry.revalidate === null)
    throw new Error(`${path} has no revalidate window`);
  const remaining = entry.generatedAt + entry.revalidate * 1000 + 50 - Date.now();
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

describe("prerendered page list", () => {
  it("lists every ssg and static page with its file and window and writes it beside the client", () => {
    expect(
      list.pages.map((entry) => [
        entry.path,
        entry.page,
        entry.render,
        entry.revalidate,
        entry.file,
      ]),
    ).toEqual([
      ["/landing", "landing", "static", null, "landing/index.html"],
      ["/news", "news", "ssg", 1, "news/index.html"],
      ["/stories/launch", "story", "ssg", null, "stories/launch/index.html"],
    ]);
    for (const entry of list.pages) expect(existsSync(join(clientDir, entry.file))).toBe(true);
    const written = parsePrerenderList(
      JSON.parse(readFileSync(join(outDir, PRERENDER_LIST_FILE), "utf8")),
    );
    expect(written).toEqual(list);
    expect(cache.size).toBe(3);
    expect(cache.has("/news/")).toBe(true);
    expect(cache.has("/live")).toBe(false);
  });

  it("maps page paths to files inside the client directory and refuses unsafe ones", () => {
    expect(prerenderedFile("/")).toBe("index.html");
    expect(prerenderedFile("/guides/getting%20started/")).toBe("guides/getting started/index.html");
    expect(normalizePagePath("/news/")).toBe("/news");
    expect(() => prerenderedFile("/notes/%2E%2E")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX404" }),
    );
    expect(() => prerenderedFile("/notes/a%2Fb")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX404" }),
    );
    expect(() =>
      parsePrerenderList({
        version: 1,
        pages: [
          {
            path: "/a",
            page: "a",
            render: "csr",
            revalidate: null,
            file: "a/index.html",
            generatedAt: 1,
          },
        ],
      }),
    ).toThrow("render must be one of ssg, static");
  });
});

describe("node adapter with prerendered pages", { timeout: 30_000 }, () => {
  it("serves a static page from disk with zero JavaScript, a per-request CSRF token and the sidecar as JSON", async () => {
    const onDisk = readFileSync(join(clientDir, "landing", "index.html"), "utf8");
    expect(csrfFieldOf(onDisk)).toBe("");

    const response = await get("/landing");
    expect(response.status).toBe(200);
    expect(response.headers.get(STATIC_HEADER)).toBe("hit");
    expect(response.headers.get(RENDER_KIND_HEADER)).toBe("page");
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("landing");
    const html = await response.text();

    expect(html).not.toContain(ENTRY_SCRIPT);
    expect(html).not.toContain("page-landing-b2.js");
    expect(html).not.toContain('rel="modulepreload"');
    expect(html).not.toContain("application/rex+data");
    expect(html).not.toContain("data-rex-ssr");
    expect(html).not.toContain(PRERENDER_NONCE);
    expect(executableScripts(html)).toEqual([]);
    expect(html).toContain(`<link rel="stylesheet" href="${ENTRY_SHEET}">`);
    expect(html).toContain("Join the list");

    expect(html).toMatch(/<form\b[^>]*\baction="\/rex\/form\/sign-up"[^>]*\bmethod="post"/);
    const token = csrfCookieOf(response);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(csrfFieldOf(html)).toBe(token);
    expect(html).toContain('name="_action" value="sign-up"');

    const sidecar = new RegExp(
      `<script type="${SIDECAR_MIME_TYPE.replace("+", "\\+")}"[^>]*>([\\s\\S]*?)</script>`,
    ).exec(html);
    expect(sidecar).not.toBeNull();
    expect(JSON.parse(sidecar?.[1] as string)).toMatchObject({ page: "landing", state: "ready" });

    const again = await get("/landing", { cookie: `${CSRF_COOKIE}=${token}` });
    expect(again.headers.get("set-cookie")).toBeNull();
    expect(csrfFieldOf(await again.text())).toBe(token);
  });

  it("runs a static page's form through the form route without JavaScript", async () => {
    const first = await get("/landing");
    const token = csrfCookieOf(first) as string;
    await first.text();
    const body = new URLSearchParams({
      _csrf: token,
      _action: "sign-up",
      email: "ada@example.com",
    });
    const response = await fetch(`${running.url}/rex/form/sign-up`, {
      method: "POST",
      redirect: "manual",
      headers: {
        origin: running.url,
        referer: `${running.url}/landing`,
        cookie: `${CSRF_COOKIE}=${token}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/landing");
    expect(signups).toEqual(["ada@example.com"]);
    const records = await ledger.list({ actionId: "sign-up" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actionId: "sign-up",
      outcome: "ok",
      actor: anonymousActor.id,
    });
  });

  it("serves an ssg page that still hydrates, with the request nonce in place of the build nonce", async () => {
    const response = await get("/stories/launch");
    expect(response.status).toBe(200);
    expect(response.headers.get(STATIC_HEADER)).toBe("hit");
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("story");
    const html = await response.text();
    expect(html).toContain("Story launch");
    expect(html).toContain('data-rex-ssr=""');
    expect(html).toContain('type="application/rex+data"');
    expect(html).toContain(`src="${ENTRY_SCRIPT}"`);
    expect(html).not.toContain(PRERENDER_NONCE);
    const nonces = new Set([...html.matchAll(/nonce="([^"]+)"/g)].map((match) => match[1]));
    expect(nonces.size).toBe(1);
  });

  it("serves the cached page after the revalidate window, regenerates in the background and serves the new HTML next", async () => {
    expect(readFileSync(join(clientDir, "news", "index.html"), "utf8")).toContain(
      "Morning edition",
    );
    headline = "Evening edition";
    await waitPastWindow("/news");

    const stale = await get("/news");
    expect(stale.status).toBe(200);
    expect(stale.headers.get(STATIC_HEADER)).toBe("stale");
    const staleHtml = await stale.text();
    expect(staleHtml).toContain("Morning edition");
    expect(staleHtml).not.toContain("Evening edition");

    await cache.settled();
    expect(regenerationErrors).toEqual([]);
    expect(readFileSync(join(clientDir, "news", "index.html"), "utf8")).toContain(
      "Evening edition",
    );

    const fresh = await get("/news");
    expect(fresh.status).toBe(200);
    const freshHtml = await fresh.text();
    expect(freshHtml).toContain("Evening edition");
    expect(freshHtml).not.toContain("Morning edition");
  });

  it("keeps serving the cached page and reports the error when regeneration fails", async () => {
    failNews = true;
    try {
      await waitPastWindow("/news");
      const before = cache.entry("/news")?.generatedAt;
      const stale = await get("/news");
      expect(stale.headers.get(STATIC_HEADER)).toBe("stale");
      expect(await stale.text()).toContain("Evening edition");
      await cache.settled();
      expect(regenerationErrors).toHaveLength(1);
      expect(regenerationErrors[0]).toBeInstanceOf(RexStaticPageError);
      expect(String(regenerationErrors[0])).toContain("render ended as failed");
      expect(cache.entry("/news")?.generatedAt).toBe(before);
      expect(readFileSync(join(clientDir, "news", "index.html"), "utf8")).toContain(
        "Evening edition",
      );
    } finally {
      failNews = false;
      await cache.settled();
      regenerationErrors.length = 0;
    }
  });

  it("rewrites the root screen, pointer and density per request from the classification the render route uses", async () => {
    const onDisk = readFileSync(join(clientDir, "landing", "index.html"), "utf8");
    expect(rootAttributes(onDisk)).toEqual({
      "data-rex-screen": "desktop",
      "data-rex-pointer": "fine",
      "data-rex-density": "comfortable",
    });

    const plain = await (await get("/landing")).text();
    expect(rootAttributes(plain)).toEqual(rootAttributes(onDisk));
    expect(sidecarOf(plain)).toMatchObject({
      screen: "desktop",
      pointer: "fine",
      density: "comfortable",
    });

    const phone = await get("/landing?density=agent", PHONE_HINTS);
    expect(phone.headers.get(STATIC_HEADER)).toBe("hit");
    expect(phone.headers.get("accept-ch")).toContain("Sec-CH-Viewport-Width");
    const phoneHtml = await phone.text();
    expect(rootAttributes(phoneHtml)).toEqual({
      "data-rex-screen": "phone",
      "data-rex-pointer": "coarse",
      "data-rex-density": "agent",
    });
    expect(rootTag(phoneHtml)).toMatch(/^<html lang="en" /);
    expect(sidecarOf(phoneHtml)).toMatchObject({
      page: "landing",
      screen: "phone",
      pointer: "coarse",
      density: "agent",
    });
    expect(phoneHtml).toContain("Join the list");

    const tablet = await get("/stories/launch", { "user-agent": TABLET_AGENT });
    expect(tablet.headers.get(STATIC_HEADER)).toBe("hit");
    const tabletHtml = await tablet.text();
    expect(rootAttributes(tabletHtml)).toEqual({
      "data-rex-screen": "tablet",
      "data-rex-pointer": "coarse",
      "data-rex-density": "comfortable",
    });
    expect(tabletHtml).toContain('data-rex-ssr=""');

    for (const headers of [PHONE_HINTS, { "user-agent": TABLET_AGENT }]) {
      const served = rootAttributes(await (await get("/landing?density=compact", headers)).text());
      const rendered = await get("/live?density=compact", headers);
      expect(rendered.headers.get(STATIC_HEADER)).toBeNull();
      expect(served).toEqual(rootAttributes(await rendered.text()));
    }
    expect(readFileSync(join(clientDir, "landing", "index.html"), "utf8")).toBe(onDisk);
  });

  it("still serves files, the API and server-rendered pages around the prerendered ones", async () => {
    const asset = await fetch(`${running.url}${ENTRY_SCRIPT}`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe(ENTRY_SOURCE);

    const health = await fetch(`${running.url}/rex/health`);
    expect(health.status).toBe(200);

    const ssr = await get("/live");
    expect(ssr.status).toBe(200);
    expect(ssr.headers.get(STATIC_HEADER)).toBeNull();
    expect(ssr.headers.get(RENDER_PAGE_HEADER)).toBe("live");
    expect(await ssr.text()).toContain("Live ticker");
  });
});

describe("static cache on the fetch-only render route", { timeout: 30_000 }, () => {
  it("serves from a memory store, generates a missing ssg page on demand and refuses to render a missing static page", async () => {
    const landingHtml = readFileSync(join(clientDir, "landing", "index.html"), "utf8");
    const memory = createStaticCache({
      pages: list.pages,
      store: memoryStaticStore([["/landing", landingHtml]]),
      screen: screenFromRequest,
    });
    const unregister = registerStaticCache(registry, memory);
    try {
      const hit = await server.fetch(
        new Request("http://rex.test/landing", { headers: { accept: "text/html" } }),
      );
      expect(hit.status).toBe(200);
      expect(hit.headers.get(STATIC_HEADER)).toBe("hit");
      const token = csrfCookieOf(hit) as string;
      expect(await hit.text()).toBe(fillCsrfToken(landingHtml, token));

      const generated = await server.fetch(
        new Request("http://rex.test/news/", { headers: { accept: "text/html" } }),
      );
      expect(generated.status).toBe(200);
      expect(generated.headers.get(STATIC_HEADER)).toBe("generated");
      expect(await generated.text()).toContain("Evening edition");
      expect(memory.entry("/news")?.generatedAt).toBeGreaterThan(
        cache.entry("/news")?.generatedAt ?? 0,
      );

      const empty = createStaticCache({
        pages: list.pages,
        store: memoryStaticStore(),
        screen: screenFromRequest,
      });
      const context = { ...prerenderContext(), nonce: "abc" };
      await expect(
        empty.serve(new Request("http://rex.test/landing"), renderer, context),
      ).rejects.toThrow(RexStaticPageError);
      await expect(
        empty.serve(new Request("http://rex.test/live"), renderer, context),
      ).resolves.toBeNull();
      expect(() =>
        createStaticCache({ pages: list.pages, store: memoryStaticStore() } as never),
      ).toThrow(expect.objectContaining({ name: "RexError", code: "REX400" }));
    } finally {
      unregister();
      registerStaticCache(registry, cache);
    }
  });
});

describe("screen attributes on prerendered documents", () => {
  const BARE =
    '<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>';
  const phone = { screen: "phone", pointer: "coarse", density: "agent" } as const;

  it("adds the attributes to an html element without them and replaces the ones already written", () => {
    const written = applyScreenAttributes(BARE, PRERENDER_SCREEN);
    expect(rootTag(written)).toBe(
      '<html lang="en" data-rex-screen="desktop" data-rex-pointer="fine" data-rex-density="comfortable">',
    );
    expect(applyScreenAttributes(written, PRERENDER_SCREEN)).toBe(written);
    expect(rootTag(applyScreenAttributes(written, phone))).toBe(
      '<html lang="en" data-rex-screen="phone" data-rex-pointer="coarse" data-rex-density="agent">',
    );
    expect(
      applyScreenAttributes(written, phone).replace(
        rootTag(applyScreenAttributes(written, phone)),
        "",
      ),
    ).toBe(written.replace(rootTag(written), ""));
  });

  it("rewrites the screen fields of the sidecar and leaves a sidecar without them untouched", () => {
    const payload = {
      version: 1,
      page: "landing",
      note: "<b>&</b>",
      screen: "desktop",
      pointer: "fine",
      density: "comfortable",
    };
    const sidecar = `<script type="${SIDECAR_MIME_TYPE}" id="rex-page" data-rex-sidecar="landing">${escapeInlineJson(payload)}</script>`;
    const html = applyScreenAttributes(
      BARE.replace("</body>", `${sidecar}</body>`),
      PRERENDER_SCREEN,
    );
    const rewritten = applyScreenAttributes(html, phone);
    expect(sidecarOf(rewritten)).toEqual({ ...payload, ...phone });
    expect(rewritten).toContain(escapeInlineJson({ ...payload, ...phone }));
    expect(rewritten).not.toContain("<b>");

    const without = `<script type="${SIDECAR_MIME_TYPE}" id="rex-page">${escapeInlineJson({ page: "landing" })}</script>`;
    const plain = applyScreenAttributes(BARE.replace("</body>", `${without}</body>`), phone);
    expect(plain).toContain(without);
  });

  it("refuses a document without an html element", () => {
    expect(() => applyScreenAttributes("<main>Hi</main>", PRERENDER_SCREEN)).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX400" }),
    );
  });
});
