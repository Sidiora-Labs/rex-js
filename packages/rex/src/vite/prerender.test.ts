import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { build, type Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prerenderBuild, type PrerenderBuildResult } from "../cli/commands/build.ts";
import type { RexEntryBundle } from "../client/entry.tsx";
import { region, view, type EagerPageModuleSet } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { anonymousActor } from "../core/actor.ts";
import { isRexError } from "../core/errors.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always, can } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { SIDECAR_MIME_TYPE } from "../manifest/sidecar.schema.ts";
import {
  PRERENDER_LIST_FILE,
  PRERENDER_NONCE,
  PRERENDER_SCREEN,
  RexStaticPageError,
  applyScreenAttributes,
  parsePrerenderList,
} from "../server/adapters/static-cache.ts";
import { memoryLedger } from "../server/audit.ts";
import {
  EMPTY_DOCUMENT_ASSETS,
  createRexRenderer,
  pageAssets,
  pageRenderMode,
  type RexDocumentAssets,
} from "../server/ssr.ts";
import { useLoader } from "../client/loaders.ts";
import { rex } from "./plugin.ts";
import {
  type PrerenderRuntime,
  expandPagePaths,
  formatPrerenderList,
  prerenderPages,
  routePath,
  stripHydration,
} from "./prerender.ts";
import { readClientManifest, readSsrAssets } from "./ssr-css.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureSource = join(here, "fixtures", "app");
const fixtureRoot = join(here, ".prerender-fixture");
const outDir = join(fixtureRoot, "dist");
const clientDir = join(outDir, "client");
const coreEntry = join(here, "..", "index.ts");
const clientEntry = join(here, "..", "client", "index.ts");
const APP = "prerender-fixture";
const BUILD_TIMEOUT_MS = 180_000;

const STATES = [
  "export function Loading() {",
  "  return <p>Loading</p>;",
  "}",
  "export function Empty() {",
  "  return <p>Empty</p>;",
  "}",
  "export function Stale() {",
  "  return <p>Stale</p>;",
  "}",
  "export function Partial() {",
  "  return <p>Partial</p>;",
  "}",
  "export function Offline() {",
  "  return <p>Offline</p>;",
  "}",
  "export function PermissionDenied() {",
  "  return <p>Denied</p>;",
  "}",
  "export function RecoverableError() {",
  "  return <p>Failed</p>;",
  "}",
  "export function TerminalError() {",
  "  return <p>Unavailable</p>;",
  "}",
  "",
].join("\n");

const FIXTURE_FILES: Readonly<Record<string, string>> = {
  "app/actions/subscribe.ts": [
    'import { action, always } from "@sidioralabs/rex";',
    'import { text } from "@sidioralabs/rex/schema";',
    'import { z } from "zod/mini";',
    "",
    'export const subscribe = action("subscribe", {',
    "  input: z.object({ email: text({ min: 3, max: 120 }) }),",
    "  output: z.object({ email: text() }),",
    "  policy: always(),",
    '  effect: "reversible",',
    '  label: "Subscribe",',
    "  handler: (input) => ({ email: input.email }),",
    "});",
    "",
  ].join("\n"),
  "app/pages/about/page.ts": [
    'import { page } from "@sidioralabs/rex";',
    'import { subscribe } from "../../actions/subscribe.ts";',
    "",
    'export default page("about", {',
    '  route: "/about",',
    '  render: "static",',
    "  actions: [subscribe],",
    '  chrome: { title: "About" },',
    '  regions: ["signup"],',
    "});",
    "",
  ].join("\n"),
  "app/pages/about/about.css": ".about-intro { color: teal; }\n",
  "app/pages/about/view.tsx": [
    'import "./about.css";',
    'import Signup from "./regions/signup/region.tsx";',
    "",
    "export default function View() {",
    "  return (",
    "    <>",
    '      <h1 className="about-intro">About Rex</h1>',
    "      <Signup />",
    "    </>",
    "  );",
    "}",
    "",
  ].join("\n"),
  "app/pages/about/states.tsx": STATES,
  "app/pages/about/regions/signup/region.tsx": [
    'import { ActionForm, region } from "@sidioralabs/rex/client";',
    'import { subscribe } from "../../../../actions/subscribe.ts";',
    "",
    'export default region("signup", () => <ActionForm action={subscribe} />);',
    "",
  ].join("\n"),
  "app/actions/list-chapters.ts": [
    'import { action, always } from "@sidioralabs/rex";',
    'import { text } from "@sidioralabs/rex/schema";',
    'import { z } from "zod/mini";',
    "",
    'export const listChapters = action("list-chapters", {',
    "  input: z.object({ slug: text({ min: 1, max: 40 }) }),",
    "  output: z.object({ titles: z.array(z.string()) }),",
    "  policy: always(),",
    '  effect: "read",',
    '  label: "List chapters",',
    "  handler: (input) => ({ titles: [`${input.slug} basics`, `${input.slug} next steps`] }),",
    "});",
    "",
  ].join("\n"),
  "app/pages/guide/page.ts": [
    'import { page } from "@sidioralabs/rex";',
    'import { text } from "@sidioralabs/rex/schema";',
    'import { z } from "zod/mini";',
    'import { listChapters } from "../../actions/list-chapters.ts";',
    "",
    'export default page("guide", {',
    '  route: "/guides/:slug",',
    "  params: z.object({ slug: text({ min: 1, max: 40 }) }),",
    '  render: "ssg",',
    "  revalidate: 60,",
    '  paths: () => [{ slug: "intro" }, { slug: "setup" }, { slug: "intro" }],',
    "  load: { chapters: { action: listChapters, input: (params) => ({ slug: String(params.slug) }) } },",
    '  chrome: { title: "Guide" },',
    '  regions: ["body"],',
    "});",
    "",
  ].join("\n"),
  "app/pages/guide/view.tsx": [
    'import { view } from "@sidioralabs/rex/client";',
    'import Body from "./regions/body/region.tsx";',
    "",
    "export default view<{ slug: string }>(({ params }) => (",
    "  <>",
    "    <h1>{`Guide ${params.slug}`}</h1>",
    "    <Body />",
    "  </>",
    "));",
    "",
  ].join("\n"),
  "app/pages/guide/states.tsx": STATES,
  "app/pages/guide/regions/body/region.tsx": [
    'import { useLoader } from "@sidioralabs/rex/client";',
    'import guide from "../../page.ts";',
    "",
    "export default function Body() {",
    '  const chapters = useLoader(guide, "chapters");',
    "  return (",
    '    <section data-rex-region="guide/body">',
    "      Read the guide",
    "      <ol>",
    "        {(chapters.data?.titles ?? []).map((title) => (",
    "          <li key={title}>{title}</li>",
    "        ))}",
    "      </ol>",
    "    </section>",
    "  );",
    "}",
    "",
  ].join("\n"),
};

const runtime: PrerenderRuntime = { createRexRenderer, pageRenderMode };

const aliasPlugin: Plugin = {
  name: "prerender-fixture-alias",
  enforce: "pre",
  resolveId(id) {
    if (id === "@sidioralabs/rex") return coreEntry;
    if (id === "@sidioralabs/rex/client") return clientEntry;
    return null;
  },
};

let assets: RexDocumentAssets;
let result: PrerenderBuildResult;

beforeAll(async () => {
  rmSync(fixtureRoot, { recursive: true, force: true });
  cpSync(fixtureSource, fixtureRoot, { recursive: true });
  for (const [file, source] of Object.entries(FIXTURE_FILES)) {
    const target = join(fixtureRoot, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  await build({
    root: fixtureRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [aliasPlugin, ...rex({ name: APP, compiler: false })],
    build: { outDir: clientDir, emptyOutDir: true, manifest: true },
  });
  assets = readSsrAssets(clientDir, { root: fixtureRoot });
  result = await prerenderBuild(fixtureRoot, {
    outDir,
    clientDir,
    assets,
    rex: { name: APP, compiler: false },
    logLevel: "silent",
    plugins: [aliasPlugin],
  });
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function read(file: string): string {
  return readFileSync(join(clientDir, file), "utf8");
}

function executableScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((match) => match[1] as string)
    .filter((attributes) => {
      const type = /\btype="([^"]*)"/.exec(attributes)?.[1];
      return type === undefined || type === "module" || type === "text/javascript";
    });
}

describe("rex build prerendering", { timeout: BUILD_TIMEOUT_MS }, () => {
  it("prerenders every ssg and static page to dist/client/<route>/index.html, expanding paths, and lists them", () => {
    expect(
      result.list.pages.map((entry) => [entry.path, entry.page, entry.render, entry.revalidate, entry.file]),
    ).toEqual([
      ["/about", "about", "static", null, "about/index.html"],
      ["/guides/intro", "guide", "ssg", 60, "guides/intro/index.html"],
      ["/guides/setup", "guide", "ssg", 60, "guides/setup/index.html"],
    ]);
    for (const entry of result.list.pages) {
      expect(existsSync(join(clientDir, entry.file))).toBe(true);
      expect(entry.generatedAt).toBeLessThanOrEqual(Date.now());
    }
    expect(existsSync(join(clientDir, "notes"))).toBe(false);
    expect(read("index.html")).not.toContain("data-rex-shell");

    expect(result.file).toBe(join(outDir, PRERENDER_LIST_FILE));
    expect(parsePrerenderList(JSON.parse(readFileSync(result.file, "utf8")))).toEqual(result.list);

    expect(formatPrerenderList(result.list)).toBe(
      [
        "rex build: prerendered /about -> dist/client/about/index.html (about, static)",
        "rex build: prerendered /guides/intro -> dist/client/guides/intro/index.html (guide, ssg, revalidate 60s)",
        "rex build: prerendered /guides/setup -> dist/client/guides/setup/index.html (guide, ssg, revalidate 60s)",
        "",
      ].join("\n"),
    );
    expect(formatPrerenderList({ version: 1, pages: [] })).toBe(
      "rex build: no ssg or static pages to prerender\n",
    );
  });

  it("writes a static page with no page chunk script, no hydration script, its actions as forms and the sidecar as JSON", () => {
    const html = read("about/index.html");
    const about = pageAssets(assets, "about");
    const scripts = Object.values(readClientManifest(clientDir))
      .map((chunk) => chunk.file)
      .filter((file) => file.endsWith(".js"));
    expect(scripts.some((file) => file.includes("page-about"))).toBe(true);
    for (const file of [...scripts, ...assets.scripts, ...assets.preloads]) {
      expect(html).not.toContain(file);
    }
    expect(html).not.toContain('<script type="module"');
    expect(html).not.toContain('rel="modulepreload"');
    expect(html).not.toContain("application/rex+data");
    expect(html).not.toContain("data-rex-ssr");
    expect(executableScripts(html)).toEqual([]);

    expect(about.stylesheets.some((href) => href.includes("page-about"))).toBe(true);
    const bodyAt = html.indexOf("<body>");
    for (const href of about.stylesheets) {
      const at = html.indexOf(`<link rel="stylesheet" href="${href}">`);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(bodyAt);
    }

    expect(html).toContain("<title>About</title>");
    expect(html).toContain("About Rex");
    expect(html).toMatch(/<form\b[^>]*\baction="\/rex\/form\/subscribe"[^>]*\bmethod="post"/);
    expect(html).toMatch(/<input type="hidden" name="_csrf" value=""\/>/);
    expect(html).toContain('name="_action" value="subscribe"');
    expect(html).toContain('name="email"');

    const sidecar = new RegExp(
      `<script type="${SIDECAR_MIME_TYPE.replace("+", "\\+")}"[^>]*>([\\s\\S]*?)</script>`,
    ).exec(html);
    expect(sidecar).not.toBeNull();
    const payload = JSON.parse(sidecar?.[1] as string) as {
      page: string;
      state: string;
      actions: readonly { id: string }[];
    };
    expect(payload).toMatchObject({ page: "about", state: "ready" });
    expect(JSON.stringify(payload)).toContain("subscribe");
  });

  it("writes the default screen, pointer and density on the html element and in the sidecar of every prerendered page", () => {
    expect(PRERENDER_SCREEN).toEqual({ screen: "desktop", pointer: "fine", density: "comfortable" });
    for (const entry of result.list.pages) {
      const html = read(entry.file);
      const root = /<html\b[^>]*>/.exec(html)?.[0] ?? "";
      expect(root).toContain(' data-rex-screen="desktop"');
      expect(root).toContain(' data-rex-pointer="fine"');
      expect(root).toContain(' data-rex-density="comfortable"');
      expect(applyScreenAttributes(html, PRERENDER_SCREEN)).toBe(html);
      const sidecar = new RegExp(
        `<script type="${SIDECAR_MIME_TYPE.replace("+", "\\+")}"[^>]*>([\\s\\S]*?)</script>`,
      ).exec(html);
      expect(sidecar).not.toBeNull();
      expect(JSON.parse(sidecar?.[1] as string)).toMatchObject({
        page: entry.page,
        screen: "desktop",
        pointer: "fine",
        density: "comfortable",
      });
    }
  });

  it("writes ssg pages that still hydrate and carry the build nonce for the server to replace", () => {
    for (const slug of ["intro", "setup"]) {
      const html = read(`guides/${slug}/index.html`);
      expect(html).toContain(`Guide ${slug}`);
      expect(html).toContain("Read the guide");
      expect(html).toContain('data-rex-ssr=""');
      expect(html).toContain('type="application/rex+data"');
      expect(html).toContain(`src="${assets.scripts[0] as string}"`);
      expect(html).toContain(`nonce="${PRERENDER_NONCE}"`);
    }
  });

  it("runs an ssg page's loaders through the action router and dehydrates them into the static document", () => {
    for (const slug of ["intro", "setup"]) {
      const html = read(`guides/${slug}/index.html`);
      expect(html).toContain(`<li>${slug} basics</li>`);
      expect(html).toContain(`<li>${slug} next steps</li>`);
      const queries = dehydratedQueries(html);
      expect(queries).toHaveLength(1);
      expect(queries[0]?.queryKey.slice(0, 3)).toEqual(["loader", "guide", "chapters"]);
      expect(queries[0]?.state).toMatchObject({
        status: "success",
        data: { titles: [`${slug} basics`, `${slug} next steps`] },
      });
    }
  });
});

interface DehydratedQuery {
  readonly queryKey: readonly unknown[];
  readonly state: { readonly status: string; readonly data?: unknown };
}

function dehydratedQueries(html: string): readonly DehydratedQuery[] {
  const script = /<script type="application\/rex\+data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  expect(script, "the document carries the dehydrated loader data").not.toBeNull();
  const payload = JSON.parse((script as RegExpExecArray)[1] as string) as {
    readonly queries: { readonly queries: readonly DehydratedQuery[] };
  };
  return payload.queries.queries;
}

describe("path expansion", () => {
  const slugParams = z.object({ slug: text({ min: 1, max: 40 }) });

  it("returns the route of a page without params", async () => {
    const plain = page("plain", { route: "/plain", render: "static" });
    expect(await expandPagePaths(plain)).toEqual(["/plain"]);
  });

  it("expands paths into encoded, de-duplicated routes", async () => {
    const docs = page("docs", {
      route: "/docs/:slug",
      params: slugParams,
      render: "ssg",
      paths: async () => [{ slug: "getting started" }, { slug: "getting started" }, { slug: "faq" }],
    });
    expect(await expandPagePaths(docs)).toEqual(["/docs/getting%20started", "/docs/faq"]);
    expect(routePath(docs, { slug: 42 })).toBe("/docs/42");
  });

  it("rejects a dynamic page without paths and params that are not one path segment with REX202", async () => {
    const missing = page("missing", { route: "/missing/:slug", params: slugParams, render: "ssg" });
    const unsafe = page("unsafe", {
      route: "/unsafe/:slug",
      params: slugParams,
      render: "static",
      paths: () => [{ slug: "a/b" }],
    });
    const empty = page("empty", {
      route: "/empty/:slug",
      params: slugParams,
      render: "ssg",
      paths: () => [{} as { slug: string }],
    });
    for (const declared of [missing, unsafe, empty]) {
      const error = await expandPagePaths(declared).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(isRexError(error)).toBe(true);
      expect((error as { code: string }).code).toBe("REX202");
      expect(String((error as Error).message)).toContain(`page "${declared.id}"`);
    }
  });

  it("strips every hydration artefact from a server-rendered document", () => {
    const document = [
      "<!doctype html><html><head>",
      '<link rel="stylesheet" href="/a.css"><link rel="modulepreload" href="/page-x.js">',
      '<script type="application/rex+data" id="rex-data" nonce="n">{"version":1}</script>',
      '</head><body><div id="root" data-rex-ssr="">',
      '<main>Hi</main><script type="application/rex+json" id="rex-sidecar">{}</script>',
      '</div><script type="module" src="/entry.js" nonce="n"></script></body></html>',
    ].join("");
    expect(stripHydration(document)).toBe(
      [
        "<!doctype html><html><head>",
        '<link rel="stylesheet" href="/a.css">',
        '</head><body><div id="root">',
        '<main>Hi</main><script type="application/rex+json" id="rex-sidecar">{}</script>',
        "</div></body></html>",
      ].join(""),
    );
  });
});

describe("prerender guards", () => {
  const ping = action("ping", {
    input: z.object({}),
    output: z.object({}),
    policy: always(),
    effect: "reversible",
    label: "Ping",
    handler: () => ({}),
  });
  const promo = page("promo", {
    route: "/promo",
    render: "static",
    actions: [ping],
    chrome: { title: "Promo" },
    regions: ["main"],
  });
  const vault = page("vault", {
    route: "/vault",
    render: "ssg",
    policy: can("vault.open"),
    chrome: { title: "Vault" },
  });
  const states = {
    Loading: () => createElement("p", null, "Loading"),
    Empty: () => createElement("p", null, "Empty"),
    Stale: () => createElement("p", null, "Stale"),
    Partial: () => createElement("p", null, "Partial"),
    Offline: () => createElement("p", null, "Offline"),
    PermissionDenied: () => createElement("p", null, "Denied"),
    RecoverableError: () => createElement("p", null, "Failed"),
    TerminalError: () => createElement("p", null, "Unavailable"),
  };
  const PromoMain = region("main", ({ act }) => {
    const handle = act(ping);
    return createElement("button", { type: "button", ...handle.controlProps }, "Ping");
  });

  function bundleOf(declared: AnyPage, modules: EagerPageModuleSet): RexEntryBundle {
    const registry = createRegistry().register(ping, declared).freeze();
    return { registry, manifest: buildManifest(registry, { app: "guards" }), pages: [modules] };
  }

  const temporary: string[] = [];
  afterAll(() => {
    for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
  });
  function tempClientDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "rex-prerender-guard-"));
    temporary.push(dir);
    return dir;
  }

  it("refuses a static page whose action renders as a JavaScript control instead of a form", async () => {
    const bundle = bundleOf(promo, {
      page: promo,
      view: view(() => createElement(PromoMain)),
      states,
      regions: { main: PromoMain },
      overlays: {},
    });
    const clientDir = tempClientDir();
    const failure = prerenderPages(
      { bundle, ssr: runtime, assets: EMPTY_DOCUMENT_ASSETS },
      { clientDir },
    );
    await expect(failure).rejects.toThrow(RexStaticPageError);
    await expect(failure).rejects.toThrow('action "ping" is not rendered as a form');
    expect(existsSync(join(clientDir, "promo", "index.html"))).toBe(false);
  });

  it("refuses a page the build actor may not open", async () => {
    const bundle = bundleOf(vault, {
      page: vault,
      view: view(() => createElement("p", null, "Vault contents")),
      states,
      regions: {},
      overlays: {},
    });
    await expect(
      prerenderPages(
        { bundle, ssr: runtime, assets: EMPTY_DOCUMENT_ASSETS },
        { clientDir: tempClientDir() },
      ),
    ).rejects.toThrow("render ended as denied");
  });

  it("runs the loaders of ssg and static pages as the build actor, audits each run and keeps the data only where the page hydrates", async () => {
    const listHeadlines = action("list-headlines", {
      input: z.object({}),
      output: z.object({ titles: z.array(z.string()) }),
      policy: always(),
      effect: "read",
      label: "List headlines",
      handler: () => ({ titles: ["Rex 0.2 ships", "Loaders run at build time"] }),
    });
    const news = page("news", {
      route: "/news",
      render: "ssg",
      load: { headlines: listHeadlines },
      chrome: { title: "News" },
    });
    const bulletin = page("bulletin", {
      route: "/bulletin",
      render: "static",
      load: { headlines: listHeadlines },
      chrome: { title: "Bulletin" },
    });
    const headlinesOf = (declared: typeof news | typeof bulletin) =>
      view(() => {
        const headlines = useLoader(declared, "headlines");
        return createElement(
          "ul",
          null,
          (headlines.data?.titles ?? []).map((title) => createElement("li", { key: title }, title)),
        );
      });
    const registry = createRegistry().register(listHeadlines, news, bulletin).freeze();
    const bundle: RexEntryBundle = {
      registry,
      manifest: buildManifest(registry, { app: "loaders" }),
      pages: [
        { page: news, view: headlinesOf(news), states, regions: {}, overlays: {} },
        { page: bulletin, view: headlinesOf(bulletin), states, regions: {}, overlays: {} },
      ],
    };
    const ledger = memoryLedger();
    const clientDir = tempClientDir();
    const list = await prerenderPages(
      { bundle, ssr: runtime, assets: EMPTY_DOCUMENT_ASSETS },
      { clientDir, ledger },
    );
    expect(list.pages.map((entry) => [entry.path, entry.render])).toEqual([
      ["/bulletin", "static"],
      ["/news", "ssg"],
    ]);
    const ssg = readFileSync(join(clientDir, "news", "index.html"), "utf8");
    const zeroJs = readFileSync(join(clientDir, "bulletin", "index.html"), "utf8");
    for (const html of [ssg, zeroJs]) {
      expect(html).toContain("<li>Rex 0.2 ships</li>");
      expect(html).toContain("<li>Loaders run at build time</li>");
    }
    expect(dehydratedQueries(ssg).map((query) => [query.queryKey.slice(0, 3), query.state.data])).toEqual([
      [["loader", "news", "headlines"], { titles: ["Rex 0.2 ships", "Loaders run at build time"] }],
    ]);
    expect(zeroJs).not.toContain("application/rex+data");
    const records = await ledger.list();
    expect(records.map((record) => [record.actionId, record.actor, record.outcome, record.effect])).toEqual([
      ["list-headlines", anonymousActor.id, "ok", "read"],
      ["list-headlines", anonymousActor.id, "ok", "read"],
    ]);
  });

  it("carries the configured font preloads and the font-display swap block into ssg and static pages", async () => {
    const leaflet = page("leaflet", { route: "/leaflet", render: "static", chrome: { title: "Leaflet" } });
    const digest = page("digest", { route: "/digest", render: "ssg", chrome: { title: "Digest" } });
    const registry = createRegistry().register(leaflet, digest).freeze();
    const bundle: RexEntryBundle = {
      registry,
      manifest: buildManifest(registry, { app: "fonts" }),
      pages: [
        { page: leaflet, view: view(() => createElement("p", null, "Leaflet")), states, regions: {}, overlays: {} },
        { page: digest, view: view(() => createElement("p", null, "Digest")), states, regions: {}, overlays: {} },
      ],
    };
    const clientDir = tempClientDir();
    const list = await prerenderPages(
      {
        bundle,
        ssr: runtime,
        assets: EMPTY_DOCUMENT_ASSETS,
        fonts: [
          { family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" },
          { family: "Mono", src: "/fonts/mono.ttf", preload: false },
        ],
      },
      { clientDir },
    );
    expect(list.pages.map((entry) => [entry.path, entry.render])).toEqual([
      ["/digest", "ssg"],
      ["/leaflet", "static"],
    ]);
    for (const file of ["digest/index.html", "leaflet/index.html"]) {
      const html = readFileSync(join(clientDir, file), "utf8");
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head).toContain(
        '<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin="">',
      );
      expect(head).not.toContain('as="font" href="/fonts/mono.ttf"');
      expect(head).toContain(
        '<style data-rex-fonts="">' +
          '@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}' +
          '@font-face{font-family:"Mono";src:url("/fonts/mono.ttf") format("truetype");font-style:normal;font-display:swap}' +
          "</style>",
      );
    }
  });
});
