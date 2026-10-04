import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { definePageModules, view } from "../../client/page.tsx";
import { actor, anonymousActor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { SIDECAR_ELEMENT_ID, SIDECAR_MIME_TYPE } from "../../core/protocol.ts";
import { createRegistry } from "../../core/registry.ts";
import { escapeInlineJson } from "../../core/serialize.ts";
import { buildManifest } from "../../manifest/build.ts";
import { DEFAULT_DENSITY } from "../context.ts";
import { CSRF_COOKIE, CSRF_FIELD } from "../form.ts";
import { createRexRenderer, screenFromRequest } from "../ssr.ts";
import {
  PRERENDER_INDEX_FILE,
  PRERENDER_LIST_FILE,
  PRERENDER_LIST_VERSION,
  PRERENDER_MODES,
  PRERENDER_NONCE,
  PRERENDER_SCREEN,
  RexStaticPageError,
  STATIC_HEADER,
  applyScreenAttributes,
  createStaticCache,
  fillCsrfToken,
  fillNonce,
  hasCsrfField,
  isPrerenderMode,
  isStale,
  memoryStaticStore,
  normalizePagePath,
  parsePrerenderList,
  prerenderContext,
  prerenderedFile,
  registerStaticCache,
  renderPrerenderedHtml,
  serializePrerenderList,
  staticCacheFor,
  type PrerenderList,
  type PrerenderMode,
  type StaticPageEntry,
} from "./static-cache.ts";

const APP = "static-cache-adapter";
const ORIGIN = "http://rex.test";
const REQUEST_NONCE = "0123456789abcdef0123456789abcdef";
const OLD_HTML = '<!doctype html><html lang="en"><body><p>Morning edition</p></body></html>';
const PHONE_HINTS = { "sec-ch-ua-mobile": "?1", "sec-ch-viewport-width": "390" } as const;

let headline = "Morning edition";

const news = page("news", {
  route: "/news",
  render: "ssg",
  revalidate: 60,
  chrome: { title: "News" },
  states: ["ready"],
});

const landing = page("landing", {
  route: "/landing",
  render: "static",
  chrome: { title: "Landing" },
  states: ["ready"],
});

const live = page("live", { route: "/live", chrome: { title: "Live" }, states: ["ready"] });

const registry = createRegistry().register(news, landing, live).freeze();
const renderer = createRexRenderer({
  bundle: {
    registry,
    manifest: buildManifest(registry, { app: APP }),
    pages: [
      definePageModules({
        page: news,
        view: view(() => createElement("p", { "data-headline": "" }, headline)),
        states: {},
      }),
      definePageModules({
        page: landing,
        view: view(() => createElement("h1", null, "Join the list")),
        states: {},
      }),
      definePageModules({
        page: live,
        view: view(() => createElement("p", null, "Live")),
        states: {},
      }),
    ],
  },
});

function entry(
  path: string,
  pageId: string,
  render: PrerenderMode,
  revalidate: number | null,
  generatedAt = Date.now(),
): StaticPageEntry {
  return { path, page: pageId, render, revalidate, file: prerenderedFile(path), generatedAt };
}

function context(nonce = REQUEST_NONCE) {
  return { ...prerenderContext(), nonce };
}

function rootTag(html: string): string {
  return /<html\b[^>]*>/.exec(html)?.[0] ?? "";
}

function rootAttributes(html: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of ["data-rex-screen", "data-rex-pointer", "data-rex-density"]) {
    const value = new RegExp(`\\s${name}="([^"]*)"`).exec(rootTag(html))?.[1];
    if (value !== undefined) found[name] = value;
  }
  return found;
}

function csrfValues(html: string): string[] {
  return [...html.matchAll(/<input[^>]*name="_csrf"[^>]*value="([^"]*)"/g)].map(
    (match) => match[1] as string,
  );
}

function rexError(code: string, message?: string) {
  return expect.objectContaining({
    name: "RexError",
    code,
    ...(message === undefined ? {} : { message: expect.stringContaining(message) }),
  });
}

describe("page paths and files", () => {
  it("normalizes page paths and maps them to index files inside the client directory", () => {
    expect(PRERENDER_INDEX_FILE).toBe("index.html");
    expect(normalizePagePath("/")).toBe("/");
    expect(normalizePagePath("/news/")).toBe("/news");
    expect(normalizePagePath("/stories/launch")).toBe("/stories/launch");
    expect(() => normalizePagePath("news")).toThrow(rexError("REX404", "must start with /"));
    expect(prerenderedFile("/")).toBe("index.html");
    expect(prerenderedFile("/news/")).toBe("news/index.html");
    expect(prerenderedFile("/stories/launch")).toBe("stories/launch/index.html");
    expect(prerenderedFile("/guides/getting%20started")).toBe("guides/getting started/index.html");
  });

  it("refuses unsafe or malformed segments with REX404", () => {
    for (const path of ["/a/..", "/a/%2E%2E", "/a/.", "/a//b", "/a/%2Fb", "/a/%5Cb", "/a/%00"]) {
      expect(() => prerenderedFile(path), path).toThrow(rexError("REX404", "unsafe segment"));
    }
    expect(() => prerenderedFile("/a/%E0%A4%A")).toThrow(rexError("REX404", "malformed segment"));
  });

  it("recognizes the prerender modes", () => {
    expect(PRERENDER_MODES).toEqual(["ssg", "static"]);
    expect(isPrerenderMode("ssg")).toBe(true);
    expect(isPrerenderMode("static")).toBe(true);
    expect(isPrerenderMode("ssr")).toBe(false);
    expect(isPrerenderMode(1)).toBe(false);
  });
});

describe("parsePrerenderList", () => {
  const written = {
    version: 1,
    pages: [
      {
        path: "/news/",
        page: "news",
        render: "ssg",
        revalidate: 60,
        file: "news/index.html",
        generatedAt: 1700000000000,
      },
      {
        path: "/landing",
        page: "landing",
        render: "static",
        revalidate: null,
        file: "landing/index.html",
        generatedAt: 1700000000001,
      },
    ],
  };

  it("accepts a well-formed list, normalizes trailing slashes and freezes it", () => {
    const list = parsePrerenderList(written);
    expect(list).toEqual({
      version: PRERENDER_LIST_VERSION,
      pages: [
        {
          path: "/news",
          page: "news",
          render: "ssg",
          revalidate: 60,
          file: "news/index.html",
          generatedAt: 1700000000000,
        },
        {
          path: "/landing",
          page: "landing",
          render: "static",
          revalidate: null,
          file: "landing/index.html",
          generatedAt: 1700000000001,
        },
      ],
    });
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list.pages)).toBe(true);
    expect(Object.isFrozen(list.pages[0])).toBe(true);
  });

  it("rejects a malformed list with REX404 naming the problem", () => {
    const first = written.pages[0] as Record<string, unknown>;
    const withEntry = (patch: Record<string, unknown>) => ({
      version: 1,
      pages: [{ ...first, ...patch }],
    });
    expect(() => parsePrerenderList("nope")).toThrow(
      rexError("REX404", `${PRERENDER_LIST_FILE} must be a JSON object`),
    );
    expect(() => parsePrerenderList({ version: 2, pages: [] })).toThrow(
      rexError("REX404", "version 2 is not 1"),
    );
    expect(() => parsePrerenderList({ version: 1, pages: {} })).toThrow(
      rexError("REX404", "pages must be a list"),
    );
    expect(() => parsePrerenderList({ version: 1, pages: ["news"] })).toThrow(
      rexError("REX404", "pages.0 must be an object"),
    );
    expect(() => parsePrerenderList(withEntry({ path: "news" }))).toThrow(
      rexError("REX404", "pages.0 path must start with /"),
    );
    expect(() => parsePrerenderList(withEntry({ page: "" }))).toThrow(
      rexError("REX404", "page must be a page id"),
    );
    expect(() => parsePrerenderList(withEntry({ render: "ssr" }))).toThrow(
      rexError("REX404", "render must be one of ssg, static"),
    );
    for (const revalidate of [0, 1.5, -1, "60"]) {
      expect(() => parsePrerenderList(withEntry({ revalidate })), String(revalidate)).toThrow(
        rexError("REX404", "revalidate must be null or a positive whole number of seconds"),
      );
    }
    expect(() => parsePrerenderList(withEntry({ file: "news.html" }))).toThrow(
      rexError("REX404", "file must be news/index.html"),
    );
    for (const generatedAt of ["now", Number.POSITIVE_INFINITY, null]) {
      expect(() => parsePrerenderList(withEntry({ generatedAt })), String(generatedAt)).toThrow(
        rexError("REX404", "generatedAt must be a timestamp in milliseconds"),
      );
    }
    expect(() =>
      parsePrerenderList({ version: 1, pages: [first, { ...first, path: "/news/" }] }),
    ).toThrow(rexError("REX404", "repeats path /news"));
  });

  it("serializes a list as indented JSON with a trailing newline that parses back", () => {
    const list = parsePrerenderList(written);
    const text = serializePrerenderList(list);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toBe(`${JSON.stringify(list, null, 2)}\n`);
    expect(parsePrerenderList(JSON.parse(text))).toEqual(list);
    expect(() =>
      serializePrerenderList({ version: 1, pages: [{ ...list.pages[0], render: "csr" }] } as never),
    ).toThrow(rexError("REX404"));
  });
});

describe("prerenderContext", () => {
  it("renders as the anonymous actor with the build nonce unless an actor is given", () => {
    const anonymous = prerenderContext();
    expect(anonymous).toEqual({
      actor: anonymousActor,
      density: DEFAULT_DENSITY,
      confirm: undefined,
      nonce: PRERENDER_NONCE,
    });
    expect(Object.isFrozen(anonymous)).toBe(true);
    const ada = actor({ id: "ada", roles: ["editor"] });
    expect(prerenderContext(ada).actor).toBe(ada);
    expect(prerenderContext(ada).nonce).toBe(PRERENDER_NONCE);
  });
});

describe("html rewriting", () => {
  it("detects csrf fields and fills every one with the token", () => {
    const token = "ab".repeat(32);
    expect(hasCsrfField('<form><input type="hidden" name="_other" value=""></form>')).toBe(false);
    const existing = `<form><input type="hidden" name="${CSRF_FIELD}" value="stale"></form>`;
    expect(hasCsrfField(existing)).toBe(true);
    expect(hasCsrfField(existing)).toBe(true);
    expect(fillCsrfToken(existing, token)).toBe(
      `<form><input type="hidden" name="${CSRF_FIELD}" value="${token}"></form>`,
    );
    const absent = `<input name="${CSRF_FIELD}" type="hidden"><input type="hidden" name="${CSRF_FIELD}" />`;
    expect(fillCsrfToken(absent, token)).toBe(
      `<input name="${CSRF_FIELD}" type="hidden" value="${token}"><input type="hidden" name="${CSRF_FIELD}" value="${token}"/>`,
    );
    expect(csrfValues(fillCsrfToken(`${existing}${existing}`, token))).toEqual([token, token]);
    expect(() => fillCsrfToken(existing, "not-hex")).toThrow(
      rexError("REX400", "token must be hexadecimal"),
    );
  });

  it("replaces the build nonce everywhere and escapes the request nonce", () => {
    const html = `<script nonce="${PRERENDER_NONCE}">1</script><style nonce="${PRERENDER_NONCE}"></style>`;
    expect(fillNonce(html, REQUEST_NONCE)).toBe(
      `<script nonce="${REQUEST_NONCE}">1</script><style nonce="${REQUEST_NONCE}"></style>`,
    );
    expect(fillNonce(html, `"><b>&'`)).toBe(
      '<script nonce="&quot;&gt;&lt;b&gt;&amp;&#39;">1</script><style nonce="&quot;&gt;&lt;b&gt;&amp;&#39;"></style>',
    );
    expect(fillNonce("<p>no nonce</p>", REQUEST_NONCE)).toBe("<p>no nonce</p>");
  });

  it("writes the screen state onto the html element and into the sidecar", () => {
    const bare = '<!doctype html><html lang="en"><head></head><body></body></html>';
    const phone = { screen: "phone", pointer: "coarse", density: "agent" } as const;
    const written = applyScreenAttributes(bare, PRERENDER_SCREEN);
    expect(rootTag(written)).toBe(
      '<html lang="en" data-rex-screen="desktop" data-rex-pointer="fine" data-rex-density="comfortable">',
    );
    expect(rootTag(applyScreenAttributes(written, phone))).toBe(
      '<html lang="en" data-rex-screen="phone" data-rex-pointer="coarse" data-rex-density="agent">',
    );
    const payload = {
      version: 1,
      page: "news",
      screen: "desktop",
      pointer: "fine",
      density: "comfortable",
    };
    const sidecar = `<script type="${SIDECAR_MIME_TYPE}" id="${SIDECAR_ELEMENT_ID}">${escapeInlineJson(payload)}</script>`;
    const rewritten = applyScreenAttributes(bare.replace("</body>", `${sidecar}</body>`), phone);
    expect(rewritten).toContain(escapeInlineJson({ ...payload, ...phone }));
    expect(rewritten).not.toContain(escapeInlineJson(payload));
    const broken = `<script type="${SIDECAR_MIME_TYPE}" id="${SIDECAR_ELEMENT_ID}">{not json</script>`;
    expect(applyScreenAttributes(bare.replace("</body>", `${broken}</body>`), phone)).toContain(
      broken,
    );
    expect(() => applyScreenAttributes("<main>Hi</main>", phone)).toThrow(
      rexError("REX400", "has no html element"),
    );
  });
});

describe("memoryStaticStore", () => {
  it("stores pages by normalized path", async () => {
    const store = memoryStaticStore([["/news/", OLD_HTML]]);
    expect(await store.read("/news")).toBe(OLD_HTML);
    expect(await store.read("/news/")).toBe(OLD_HTML);
    expect(await store.read("/landing")).toBeNull();
    await store.write("/landing/", "<html></html>");
    expect(await store.read("/landing")).toBe("<html></html>");
    await expect(store.read("news")).rejects.toThrow(rexError("REX404"));
  });
});

describe("isStale", () => {
  it("expires an entry once its revalidate window has passed and never without one", () => {
    const timed = entry("/news", "news", "ssg", 60, 1_000_000);
    expect(isStale(timed, 1_000_000 + 59_999)).toBe(false);
    expect(isStale(timed, 1_000_000 + 60_000)).toBe(true);
    expect(isStale(entry("/landing", "landing", "static", null, 0), Number.MAX_SAFE_INTEGER)).toBe(
      false,
    );
  });
});

describe("createStaticCache", () => {
  it("requires a screen classifier and exposes the listed entries", () => {
    expect(() => createStaticCache({ pages: [], store: memoryStaticStore() } as never)).toThrow(
      rexError("REX400", "screen must classify each request"),
    );
    const listed = [
      entry("/news/", "news", "ssg", 60),
      entry("/landing", "landing", "static", null),
    ];
    const cache = createStaticCache({
      pages: listed,
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    expect(cache.size).toBe(2);
    expect(cache.has("/news")).toBe(true);
    expect(cache.has("/news/")).toBe(true);
    expect(cache.has("/live")).toBe(false);
    expect(cache.has("news")).toBe(false);
    expect(cache.entry("/landing/")).toEqual({ ...listed[1], path: "/landing" });
    expect(cache.entry("/nowhere")).toBeUndefined();
    expect(cache.entries().map((item) => item.path)).toEqual(["/news", "/landing"]);
    expect(Object.isFrozen(cache.entries())).toBe(true);
    expect(() =>
      createStaticCache({
        pages: [...listed, listed[0] as StaticPageEntry],
        store: memoryStaticStore(),
        screen: screenFromRequest,
      }),
    ).toThrow(rexError("REX404", "repeats path /news"));
  });

  it("serves a cached page with the request nonce, the request screen and a csrf grant", async () => {
    const stored = [
      "<!doctype html>",
      '<html lang="en">',
      `<head><script nonce="${PRERENDER_NONCE}">1</script></head>`,
      `<body><form method="post"><input type="hidden" name="${CSRF_FIELD}" value=""></form></body>`,
      "</html>",
    ].join("");
    const cache = createStaticCache({
      pages: [entry("/landing", "landing", "static", null)],
      store: memoryStaticStore([["/landing", stored]]),
      screen: screenFromRequest,
    });
    const first = await cache.serve(
      new Request(`${ORIGIN}/landing/?density=agent`, { headers: PHONE_HINTS }),
      undefined,
      context(),
    );
    expect(first).not.toBeNull();
    expect(first?.page).toBe("landing");
    expect(first?.path).toBe("/landing");
    expect(first?.status).toBe("hit");
    expect(first?.html).toContain(`nonce="${REQUEST_NONCE}"`);
    expect(first?.html).not.toContain(PRERENDER_NONCE);
    expect(rootAttributes(first?.html ?? "")).toEqual({
      "data-rex-screen": "phone",
      "data-rex-pointer": "coarse",
      "data-rex-density": "agent",
    });
    const token = /rex-csrf=([0-9a-f]{64})/.exec(first?.setCookie ?? "")?.[1];
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(csrfValues(first?.html ?? "")).toEqual([token]);

    const again = await cache.serve(
      new Request(`${ORIGIN}/landing`, { headers: { cookie: `${CSRF_COOKIE}=${token ?? ""}` } }),
      undefined,
      context(),
    );
    expect(again?.setCookie).toBeNull();
    expect(csrfValues(again?.html ?? "")).toEqual([token]);
    expect(rootAttributes(again?.html ?? "")).toEqual({
      "data-rex-screen": "desktop",
      "data-rex-pointer": "fine",
      "data-rex-density": "comfortable",
    });
    expect(STATIC_HEADER).toBe("x-rex-static");
  });

  it("returns null for paths that are not listed", async () => {
    const cache = createStaticCache({
      pages: [entry("/news", "news", "ssg", 60)],
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    await expect(
      cache.serve(new Request(`${ORIGIN}/live`), renderer, context()),
    ).resolves.toBeNull();
    await expect(
      cache.serve(new Request(`${ORIGIN}/news.html`), renderer, context()),
    ).resolves.toBeNull();
  });

  it("generates a missing ssg page through the renderer and stores it with the build nonce", async () => {
    headline = "Morning edition";
    const store = memoryStaticStore();
    const listed = entry("/news", "news", "ssg", 60, 0);
    const cache = createStaticCache({ pages: [listed], store, screen: screenFromRequest });
    const before = Date.now();
    const hit = await cache.serve(
      new Request(`${ORIGIN}/news`, { headers: { accept: "text/html" } }),
      renderer,
      context(),
    );
    expect(hit?.status).toBe("generated");
    expect(hit?.page).toBe("news");
    expect(hit?.html).toContain("Morning edition");
    expect(hit?.html).toContain(`nonce="${REQUEST_NONCE}"`);
    expect(hit?.html).not.toContain(PRERENDER_NONCE);
    const stored = await store.read("/news");
    expect(stored).toContain("Morning edition");
    expect(stored).toContain(`nonce="${PRERENDER_NONCE}"`);
    expect(rootAttributes(stored ?? "")).toEqual({
      "data-rex-screen": "desktop",
      "data-rex-pointer": "fine",
      "data-rex-density": "comfortable",
    });
    expect(cache.entry("/news")?.generatedAt).toBeGreaterThanOrEqual(before);
    expect(cache.entries()[0]).toBe(cache.entry("/news"));
    const second = await cache.serve(new Request(`${ORIGIN}/news`), renderer, context());
    expect(second?.status).toBe("hit");
  });

  it("serves a stale page at once and regenerates it in the background", async () => {
    headline = "Evening edition";
    const store = memoryStaticStore([["/news", OLD_HTML]]);
    const cache = createStaticCache({
      pages: [entry("/news", "news", "ssg", 1, 0)],
      store,
      screen: screenFromRequest,
    });
    const stale = await cache.serve(new Request(`${ORIGIN}/news`), renderer, context());
    expect(stale?.status).toBe("stale");
    expect(stale?.html).toContain("Morning edition");
    expect(stale?.html).not.toContain("Evening edition");
    await cache.settled();
    expect(await store.read("/news")).toContain("Evening edition");
    expect(cache.entry("/news")?.generatedAt).toBeGreaterThan(0);
    const fresh = await cache.serve(new Request(`${ORIGIN}/news`), renderer, context());
    expect(fresh?.status).toBe("hit");
    expect(fresh?.html).toContain("Evening edition");
  });

  it("reports a failed background regeneration through onError and keeps the cached page", async () => {
    const store = memoryStaticStore([["/missing", OLD_HTML]]);
    const failures: [unknown, StaticPageEntry][] = [];
    const listed = entry("/missing", "ghost", "ssg", 1, 0);
    const cache = createStaticCache({
      pages: [listed],
      store,
      screen: screenFromRequest,
      onError: (error, failed) => {
        failures.push([error, failed]);
      },
    });
    const stale = await cache.serve(new Request(`${ORIGIN}/missing`), renderer, context());
    expect(stale?.status).toBe("stale");
    await cache.settled();
    expect(failures).toHaveLength(1);
    const [error, failed] = failures[0] as [unknown, StaticPageEntry];
    expect(error).toBeInstanceOf(RexStaticPageError);
    expect(error).toMatchObject({
      code: "REX405",
      page: "(none)",
      path: "/missing",
      message:
        'REX405 page "(none)" at /missing cannot be prerendered: the render ended as not-found',
    });
    expect(failed).toEqual(listed);
    expect(await store.read("/missing")).toBe(OLD_HTML);
    expect(cache.entry("/missing")?.generatedAt).toBe(0);
  });

  it("refuses to regenerate static pages, unlisted paths, pages without a renderer and pages that moved", async () => {
    const cache = createStaticCache({
      pages: [entry("/landing", "landing", "static", null), entry("/news", "landing", "ssg", 60)],
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    await expect(cache.regenerate("/landing", ORIGIN, renderer)).rejects.toThrow(
      RexStaticPageError,
    );
    await expect(cache.regenerate("/landing", ORIGIN, renderer)).rejects.toMatchObject({
      code: "REX405",
      page: "landing",
      path: "/landing",
      message: expect.stringContaining("renders static and is only generated by rex build"),
    });
    await expect(cache.regenerate("/nowhere", ORIGIN, renderer)).rejects.toThrow(
      rexError("REX404", "no prerendered page is listed at /nowhere"),
    );
    await expect(cache.regenerate("/news", ORIGIN, undefined)).rejects.toMatchObject({
      code: "REX405",
      message: expect.stringContaining("no page renderer is registered"),
    });
    await expect(cache.regenerate("/news", ORIGIN, renderer)).rejects.toMatchObject({
      code: "REX405",
      page: "landing",
      path: "/news",
      message: expect.stringContaining('the path now renders page "news"'),
    });
    await expect(
      cache.serve(new Request(`${ORIGIN}/landing`), renderer, context()),
    ).rejects.toThrow(RexStaticPageError);
  });

  it("shares one in-flight regeneration per path", async () => {
    const store = memoryStaticStore();
    const cache = createStaticCache({
      pages: [entry("/news", "news", "ssg", 60)],
      store,
      screen: screenFromRequest,
    });
    const first = cache.regenerate("/news/", ORIGIN, renderer);
    const second = cache.regenerate("/news", ORIGIN, renderer);
    expect(second).toBe(first);
    const generated = await first;
    expect(generated.path).toBe("/news");
    expect(generated).toBe(cache.entry("/news"));
    expect(await store.read("/news")).toContain(headline);
    const third = cache.regenerate("/news", ORIGIN, renderer);
    expect(third).not.toBe(first);
    await cache.settled();
    expect(await third).toBe(cache.entry("/news"));
  });
});

describe("renderPrerenderedHtml", () => {
  it("renders a listed page for the anonymous actor with the build nonce", async () => {
    headline = "Launch edition";
    const rendered = await renderPrerenderedHtml(renderer, new URL("/news", ORIGIN));
    expect(rendered.page).toBe("news");
    expect(rendered.html).toContain("Launch edition");
    expect(rendered.html).toContain(`nonce="${PRERENDER_NONCE}"`);
    expect(rendered.html).toMatch(/^<!doctype html>/i);
  });

  it("refuses a path that does not render a page", async () => {
    await expect(
      renderPrerenderedHtml(renderer, new URL("/missing", ORIGIN)),
    ).rejects.toMatchObject({
      name: "RexStaticPageError",
      code: "REX405",
      page: "(none)",
      path: "/missing",
      message: expect.stringContaining("the render ended as not-found"),
    });
  });
});

describe("registerStaticCache", () => {
  it("binds a cache to a registry object and unbinds only the same cache", () => {
    const first = createStaticCache({
      pages: [],
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    const second = createStaticCache({
      pages: [],
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    const key = {};
    expect(staticCacheFor(key)).toBeUndefined();
    expect(() => registerStaticCache("registry" as never, first)).toThrow(
      rexError("REX400", "registry must be the app registry object"),
    );
    expect(() => registerStaticCache(key, {} as never)).toThrow(
      rexError("REX400", "cache must come from createStaticCache"),
    );
    const unregisterFirst = registerStaticCache(key, first);
    expect(staticCacheFor(key)).toBe(first);
    registerStaticCache(key, second);
    expect(staticCacheFor(key)).toBe(second);
    unregisterFirst();
    expect(staticCacheFor(key)).toBe(second);
    registerStaticCache(key, second)();
    expect(staticCacheFor(key)).toBeUndefined();
  });
});

describe("prerender list type", () => {
  it("round-trips the entries the cache was built from", () => {
    const list: PrerenderList = parsePrerenderList({
      version: PRERENDER_LIST_VERSION,
      pages: [entry("/news", "news", "ssg", 60, 5)],
    });
    const cache = createStaticCache({
      pages: list.pages,
      store: memoryStaticStore(),
      screen: screenFromRequest,
    });
    expect(cache.entries()).toEqual(list.pages);
  });
});
