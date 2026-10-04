import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { REX_DATA_ELEMENT_ID, REX_DATA_MIME_TYPE, SSR_ATTRIBUTE } from "../client/hydrate.ts";
import { defineI18n } from "../client/i18n/context.ts";
import type { PriorityImage } from "../client/media.tsx";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { NOT_FOUND_TITLE } from "../client/shell.tsx";
import { anonymousActor } from "../core/actor.ts";
import { resolveOptions } from "../core/config.ts";
import { page, type AnyPage } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { STATE_EXPORT_NAMES } from "../core/states.ts";
import { buildManifest } from "../manifest/build.ts";
import { text } from "../schema/index.ts";
import { CLIENT_HINT_HEADERS } from "./adapters/client-hints.ts";
import { DENSITY_HEADER, createRexContext, type RexRequestContext } from "./context.ts";
import { registerPageRenderer } from "./routes/render.ts";
import {
  DEFAULT_DOCUMENT_LANG,
  DEFAULT_ROOT_ELEMENT,
  EMPTY_DOCUMENT_ASSETS,
  RENDER_FAILURE_MESSAGE,
  RexClientRenderSignal,
  createRexRenderer,
  documentStream,
  escapeHtml,
  fontFaceCss,
  fontPreloadLinks,
  imagePreloadLinks,
  matchPage,
  nonceInlineScripts,
  pageAssets,
  pageRenderMode,
  registerPageRenderer as reexportedRegisterPageRenderer,
  requestLocale,
  routedPathname,
  screenFromRequest,
  type RexDocumentAssets,
} from "./ssr.ts";

const home = page("home", { route: "/", chrome: { title: "Home" } });
const newAccount = page("new-account", { route: "/portfolio/new" });
const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: text({ min: 1 }) }),
});
const holding = page("holding", {
  route: "/portfolio/:account/holdings/:symbol",
  params: z.object({ account: text({ min: 1 }), symbol: text({ min: 1 }) }),
});
const pages = [portfolio, home, holding, newAccount];

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

function request(headers: Readonly<Record<string, string>> = {}, search = ""): Request {
  return new Request(`http://rex.test/portfolio${search}`, { headers });
}

function contextFor(target: Request): Promise<RexRequestContext> {
  return createRexContext(target, () => anonymousActor);
}

async function classify(headers: Readonly<Record<string, string>> = {}, search = "") {
  const target = request(headers, search);
  return screenFromRequest(target, await contextFor(target));
}

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

describe("matchPage", () => {
  it("prefers static segments, ignores case and a trailing slash and extracts the route params", () => {
    expect(matchPage(pages, "/")?.page).toBe(home);
    expect(matchPage(pages, "/")?.routeParams).toEqual({});
    expect(matchPage(pages, "/portfolio/new")?.page).toBe(newAccount);
    const trailing = matchPage(pages, "/portfolio/acc-1/");
    expect(trailing?.page).toBe(portfolio);
    expect(trailing?.routeParams).toEqual({ account: "acc-1" });
    expect(Object.isFrozen(trailing?.routeParams)).toBe(true);
    const cased = matchPage(pages, "/Portfolio/ACC");
    expect(cased?.page).toBe(portfolio);
    expect(cased?.routeParams).toEqual({ account: "ACC" });
    const nested = matchPage(pages, "/portfolio/acc-1/holdings/btc");
    expect(nested?.page).toBe(holding);
    expect(nested?.routeParams).toEqual({ account: "acc-1", symbol: "btc" });
    expect(matchPage(pages, "/portfolio")).toBeNull();
    expect(matchPage(pages, "/portfolio/acc-1/holdings")).toBeNull();
    expect(matchPage(pages, "/portfolio//holdings/btc")).toBeNull();
    expect(matchPage(pages, "/nowhere")).toBeNull();
    expect(matchPage([], "/")).toBeNull();
  });
});

describe("screenFromRequest", () => {
  it("classifies the screen from client hints, the user agent and the density preference", async () => {
    expect(await classify()).toEqual({
      screen: "desktop",
      pointer: "fine",
      density: "comfortable",
    });
    expect(await classify({ [CLIENT_HINT_HEADERS.viewportWidth]: "390" })).toEqual({
      screen: "phone",
      pointer: "fine",
      density: "comfortable",
    });
    expect(
      await classify({
        [CLIENT_HINT_HEADERS.viewportWidth]: "1920",
        [CLIENT_HINT_HEADERS.mobile]: "?0",
      }),
    ).toEqual({ screen: "wide", pointer: "fine", density: "comfortable" });
    expect(await classify({ [CLIENT_HINT_HEADERS.viewportWidth]: "800" })).toMatchObject({
      screen: "tablet",
      pointer: "fine",
    });
    expect(await classify({ [CLIENT_HINT_HEADERS.mobile]: "?1" })).toEqual({
      screen: "phone",
      pointer: "coarse",
      density: "comfortable",
    });
    expect(await classify({ [CLIENT_HINT_HEADERS.userAgent]: IPHONE })).toMatchObject({
      screen: "phone",
      pointer: "coarse",
    });
    expect(await classify({ [CLIENT_HINT_HEADERS.userAgent]: IPAD })).toMatchObject({
      screen: "tablet",
      pointer: "coarse",
    });
    expect(
      await classify({
        [CLIENT_HINT_HEADERS.userAgent]: IPHONE,
        [CLIENT_HINT_HEADERS.mobile]: "?0",
      }),
    ).toMatchObject({ screen: "desktop", pointer: "fine" });
    expect(await classify({ [CLIENT_HINT_HEADERS.viewportWidth]: "wide" })).toMatchObject({
      screen: "desktop",
    });
    expect(await classify({}, "?density=agent")).toMatchObject({ density: "agent" });
    expect(await classify({ [DENSITY_HEADER]: "agent" })).toMatchObject({ density: "agent" });
    expect(await classify({ [DENSITY_HEADER]: "agent" }, "?density=compact")).toMatchObject({
      density: "compact",
    });
    expect(await classify({}, "?density=huge")).toMatchObject({ density: "comfortable" });
    expect(Object.isFrozen(await classify())).toBe(true);
  });
});

describe("pageRenderMode", () => {
  it("prefers the manifest's listed mode, then the declaration, then ssr", () => {
    const landing = page("landing", { route: "/landing", render: "static" });
    const live = page("live", { route: "/live" });
    const registry = createRegistry().register(landing, live).freeze();
    const manifest = buildManifest(registry, { app: "ssr-modes", render: "csr" });
    expect(pageRenderMode(manifest, landing)).toBe("static");
    expect(pageRenderMode(manifest, live)).toBe("csr");
    expect(pageRenderMode(manifest, page("lab", { route: "/lab", render: "ssg" }))).toBe("ssg");
    expect(pageRenderMode(manifest, page("plain", { route: "/plain" }))).toBe("ssr");
  });
});

describe("document helpers", () => {
  it("escapeHtml escapes markup characters and nonceInlineScripts tags only inline scripts without a nonce", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
    expect(escapeHtml("plain text")).toBe("plain text");
    const head =
      '<script>window.a=1</script><script type="module">import "/x.js"</script><script src="/vendor.js"></script><script nonce="keep">b()</script><SCRIPT data-x>c()</SCRIPT>';
    expect(nonceInlineScripts(head, 'n"1')).toBe(
      '<script nonce="n&quot;1">window.a=1</script><script type="module" nonce="n&quot;1">import "/x.js"</script><script src="/vendor.js"></script><script nonce="keep">b()</script><script data-x nonce="n&quot;1">c()</SCRIPT>',
    );
    expect(nonceInlineScripts("<p>no scripts</p>", "abc")).toBe("<p>no scripts</p>");
  });

  it("fontPreloadLinks and fontFaceCss describe the resolved fonts", () => {
    const fonts = resolveOptions({
      fonts: [
        { family: "Inter", src: "/fonts/inter.woff2?v=3", weight: 400 },
        { family: 'Say "Mono"', src: "/fonts/mono.ttf", style: "italic", preload: false },
        { family: "Legacy", src: "https://cdn.test/legacy.eot", weight: "100 900" },
      ],
    }).fonts;
    expect(fontPreloadLinks(fonts)).toEqual([
      '<link rel="preload" as="font" href="/fonts/inter.woff2?v=3" type="font/woff2" crossorigin="">',
      '<link rel="preload" as="font" href="https://cdn.test/legacy.eot" crossorigin="">',
    ]);
    expect(fontFaceCss(fonts)).toBe(
      '@font-face{font-family:"Inter";src:url("/fonts/inter.woff2?v=3") format("woff2");font-weight:400;font-style:normal;font-display:swap}' +
        '@font-face{font-family:"Say \\"Mono\\"";src:url("/fonts/mono.ttf") format("truetype");font-style:italic;font-display:swap}' +
        '@font-face{font-family:"Legacy";src:url("https://cdn.test/legacy.eot");font-weight:100 900;font-style:normal;font-display:swap}',
    );
    expect(fontPreloadLinks([])).toEqual([]);
    expect(fontFaceCss([])).toBe("");
  });

  it("imagePreloadLinks and pageAssets build the per-page head links", () => {
    const images: PriorityImage[] = [
      { src: "/hero.jpg", srcSet: "/hero.jpg 1x, /hero@2x.jpg 2x", sizes: "100vw" },
      { src: "/a&b.png", srcSet: null, sizes: null },
    ];
    expect(imagePreloadLinks(images)).toEqual([
      '<link rel="preload" as="image" href="/hero.jpg" imagesrcset="/hero.jpg 1x, /hero@2x.jpg 2x" imagesizes="100vw" fetchpriority="high">',
      '<link rel="preload" as="image" href="/a&amp;b.png" fetchpriority="high">',
    ]);
    expect(imagePreloadLinks([])).toEqual([]);
    const assets: RexDocumentAssets = {
      scripts: ["/entry.js"],
      stylesheets: ["/entry.css", "/theme.css"],
      preloads: ["/entry.js"],
      pages: {
        landing: {
          stylesheets: ["/landing.css", "/theme.css"],
          preloads: ["/page-landing.js", "/entry.js"],
        },
      },
    };
    expect(pageAssets(assets, "landing")).toEqual({
      stylesheets: ["/entry.css", "/theme.css", "/landing.css"],
      preloads: ["/entry.js", "/page-landing.js"],
    });
    expect(pageAssets(assets, "unknown")).toEqual({
      stylesheets: ["/entry.css", "/theme.css"],
      preloads: ["/entry.js"],
    });
    expect(pageAssets(assets, null)).toEqual(pageAssets(assets, "unknown"));
    expect(pageAssets(EMPTY_DOCUMENT_ASSETS, "landing")).toEqual({ stylesheets: [], preloads: [] });
    expect(Object.isFrozen(EMPTY_DOCUMENT_ASSETS)).toBe(true);
    expect(Object.isFrozen(EMPTY_DOCUMENT_ASSETS.pages)).toBe(true);
  });

  it("documentStream wraps the body between the head and the tail and forwards cancellation", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("<p>one</p>"));
        controller.enqueue(encoder.encode("<p>two</p>"));
        controller.close();
      },
    });
    expect(await new Response(documentStream("<head>", body, "</html>")).text()).toBe(
      "<head><p>one</p><p>two</p></html>",
    );
    const reasons: unknown[] = [];
    const open = new ReadableStream<Uint8Array>({
      cancel(reason) {
        reasons.push(reason);
      },
    });
    const reader = documentStream("<head>", open, "</html>").getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(new TextDecoder().decode(first.value)).toBe("<head>");
    await reader.cancel("client left");
    expect(reasons).toEqual(["client left"]);
  });
});

describe("request locale helpers", () => {
  it("requestLocale keeps a known context locale and otherwise negotiates from the request", async () => {
    const prefixed = defineI18n({
      config: { locales: ["en", "fr"], default: "en", routing: "prefix" },
      messages: {},
    });
    const unrouted = defineI18n({ config: { locales: ["en", "fr"], default: "en" }, messages: {} });
    const french = new Request("http://rex.test/notes", {
      headers: { "accept-language": "fr-CA, en;q=0.5" },
    });
    const context = await contextFor(french);
    expect(context.locale).toBeUndefined();
    expect(requestLocale(null, french, context)).toBeNull();
    expect(requestLocale(prefixed, french, context)).toBe("fr");
    const known: RexRequestContext = {
      actor: context.actor,
      density: context.density,
      nonce: context.nonce,
      locale: "en",
    };
    expect(requestLocale(prefixed, french, known)).toBe("en");
    expect(requestLocale(prefixed, french, { ...known, locale: "de" })).toBe("fr");
    const routed = new Request("http://rex.test/fr/notes");
    expect(requestLocale(prefixed, routed, await contextFor(routed))).toBe("fr");
    expect(requestLocale(unrouted, routed, await contextFor(routed))).toBe("en");
    const seeded = await createRexContext(routed, () => anonymousActor, prefixed.settings);
    expect(seeded.locale).toBe("fr");
    expect(requestLocale(prefixed, routed, seeded)).toBe("fr");
  });

  it("routedPathname strips the locale prefix only when the app routes by prefix", () => {
    const prefixed = defineI18n({
      config: { locales: ["en", "fr"], default: "en", routing: "prefix" },
      messages: {},
    });
    const unrouted = defineI18n({ config: { locales: ["en", "fr"], default: "en" }, messages: {} });
    expect(routedPathname(prefixed, "/fr/notes")).toBe("/notes");
    expect(routedPathname(prefixed, "/FR/notes/n1")).toBe("/notes/n1");
    expect(routedPathname(prefixed, "/fr")).toBe("/");
    expect(routedPathname(prefixed, "/de/notes")).toBe("/de/notes");
    expect(routedPathname(prefixed, "/notes")).toBe("/notes");
    expect(routedPathname(unrouted, "/fr/notes")).toBe("/fr/notes");
    expect(routedPathname(null, "/fr/notes")).toBe("/fr/notes");
  });
});

describe("createRexRenderer", () => {
  it("refuses a bundle without pages or without its manifest and names the client render signal", () => {
    const registry = createRegistry().register(home).freeze();
    expect(() =>
      createRexRenderer({ bundle: { registry, manifest: buildManifest(registry) } as never }),
    ).toThrow(expect.objectContaining({ name: "RexError", code: "REX313" }));
    expect(() => createRexRenderer({ bundle: { registry, pages: [] } })).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX400" }),
    );
    const renderer = createRexRenderer({
      bundle: { registry, manifest: buildManifest(registry), pages: [] },
    });
    expect(typeof renderer.render).toBe("function");
    expect(reexportedRegisterPageRenderer).toBe(registerPageRenderer);
    expect(DEFAULT_ROOT_ELEMENT).toBe("root");
    expect(DEFAULT_DOCUMENT_LANG).toBe("en");
    expect(RENDER_FAILURE_MESSAGE).toBe("The page failed to render on the server");
    const signal = new RexClientRenderSignal("landing");
    expect(signal).toBeInstanceOf(Error);
    expect(signal.name).toBe("RexClientRenderSignal");
    expect(signal.page).toBe("landing");
    expect(signal.message).toBe('page "landing" renders on the client (render: csr)');
  });

  it("renders the not-found document with the request nonce, screen attributes, assets and fonts", async () => {
    const registry = createRegistry().register(home).freeze();
    const HomeView = view(() => createElement("p", null, "Home sweet home"));
    const renderer = createRexRenderer({
      bundle: {
        registry,
        manifest: buildManifest(registry, { app: "ssr-document" }),
        pages: [lazySet(home, { view: HomeView, states: statesFor("Home") })],
      },
      assets: {
        scripts: ["/entry.js"],
        stylesheets: ["/entry.css"],
        preloads: ["/entry.js"],
        head: "<script>window.__rex=1</script>",
        pages: {},
      },
      fonts: [{ family: "Inter", src: "/fonts/inter.woff2" }],
      lang: "fr",
      rootElement: "app",
    });
    const target = new Request("http://rex.test/nowhere", {
      headers: { accept: "text/html", [CLIENT_HINT_HEADERS.viewportWidth]: "390" },
    });
    const context = await contextFor(target);
    const result = await renderer.render(target, context);
    expect(result.kind).toBe("not-found");
    expect(result.page).toBeNull();
    const html = await new Response(result.body).text();
    const opening =
      '<!doctype html><html lang="fr" data-rex-screen="phone" data-rex-pointer="fine" data-rex-density="comfortable"><head><meta charset="utf-8">';
    expect(html.slice(0, opening.length)).toBe(opening);
    expect(html).toContain(`<title>${escapeHtml(NOT_FOUND_TITLE)}</title>`);
    expect(html).toContain(
      '<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin="">',
    );
    expect(html).toContain(
      '<style data-rex-fonts="">@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-style:normal;font-display:swap}</style>',
    );
    expect(html).toContain('<link rel="stylesheet" href="/entry.css">');
    expect(html).toContain('<link rel="modulepreload" href="/entry.js">');
    expect(html).toContain(`<script nonce="${context.nonce}">window.__rex=1</script>`);
    expect(html).toContain(
      `<script type="${REX_DATA_MIME_TYPE}" id="${REX_DATA_ELEMENT_ID}" nonce="${context.nonce}">`,
    );
    expect(html).toContain(`<div id="app" ${SSR_ATTRIBUTE}="">`);
    const closing = `</div><script type="module" src="/entry.js" nonce="${context.nonce}"></script></body></html>`;
    expect(html.slice(-closing.length)).toBe(closing);
    expect(html).not.toContain("Home sweet home");
  });
});
