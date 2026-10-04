import { act, cleanup, waitFor } from "@testing-library/react";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readSidecar } from "../client/agent/sidecar.tsx";
import { startRexEntry, type RexEntryBundle, type StartedRex } from "../client/entry.tsx";
import {
  REX_DATA_ELEMENT_ID,
  REX_DATA_MIME_TYPE,
  SSR_ATTRIBUTE,
  readRexData,
  type HydrationMismatch,
} from "../client/hydrate.ts";
import { Img, SCRIPT_ATTRIBUTE, Script } from "../client/media.tsx";
import { ActionForm } from "../client/form.tsx";
import { region, view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { can } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { SIDECAR_MIME_TYPE } from "../manifest/sidecar.schema.ts";
import { rex } from "../vite/plugin.ts";
import { CLIENT_MANIFEST_FILE, ssrAssetsFromManifest, type ViteManifest } from "../vite/ssr-css.ts";
import { createRexServer } from "./app.ts";
import { memoryLedger } from "./audit.ts";
import { DEFAULT_DENSITY } from "./context.ts";
import { CSRF_COOKIE, CSRF_FIELD, bindCsrfGrant, ensureCsrfToken } from "./form.ts";
import { RENDER_STATUS, type RexPageRenderer } from "./routes/render.ts";
import {
  createRexRenderer,
  pageAssets,
  registerPageRenderer,
  type RexDocumentAssets,
} from "./ssr.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureSource = join(here, "..", "vite", "fixtures", "app");
const fixtureRoot = join(here, ".ssr-fixture");
const coreEntry = join(here, "..", "index.ts");
const BUILD_TIMEOUT_MS = 120_000;

const added: string[] = [];

const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: z.object({ title: text() }),
  policy: can("notes.write"),
  effect: "reversible",
  label: "Add note",
  handler: (input) => {
    added.push(input.title);
    return { title: input.title };
  },
});

const home = page("home", {
  route: "/",
  actions: [addNote],
  chrome: { title: "Notes" },
  regions: ["main"],
});

const vault = page("vault", {
  route: "/vault",
  policy: can("vault.open"),
  chrome: { title: "Vault" },
});

const later = page("later", {
  route: "/later",
  render: "csr",
  chrome: { title: "Later" },
});

const gallery = page("gallery", {
  route: "/gallery",
  chrome: { title: "Gallery" },
});

const broken = page("broken", {
  route: "/broken",
  chrome: { title: "Broken" },
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return {
    Loading: () => <p>{label} is loading</p>,
    Empty: () => <p>{label} is empty</p>,
    Stale: () => <p>{label} may be stale</p>,
    Partial: () => <p>{label} is partial</p>,
    Offline: () => <p>{label} is offline</p>,
    PermissionDenied: () => <p>You cannot open {label}</p>,
    RecoverableError: () => <p>{label} failed</p>,
    TerminalError: () => <p>{label} is unavailable</p>,
  };
}

const HomeMain = region("main", ({ act: useAct }) => {
  const add = useAct(addNote);
  return (
    <button
      type="button"
      {...add.controlProps}
      onClick={() => {
        void add.run({ title: "Streamed note" });
      }}
    >
      Add note
    </button>
  );
});

const HomeView = view(() => (
  <>
    <p>Notes home</p>
    <HomeMain />
  </>
));

const VaultView = view(() => <p>Vault contents</p>);
const HERO_SRC = "/images/hero.avif";
const HERO_SRCSET = "/images/hero-640.avif 640w, /images/hero-1200.avif 1200w";
const HERO_SIZES = "(max-width: 640px) 100vw, 1200px";
const WIDGET_SRC = "/vendor/widget.js";
const GalleryView = view(() => (
  <>
    <Img src={HERO_SRC} srcSet={HERO_SRCSET} sizes={HERO_SIZES} alt="Harbour at dusk" width={1200} height={630} priority />
    <Img src="/images/thumb.avif" alt="Thumbnail" width={320} height={180} />
    <Script src={WIDGET_SRC} strategy="beforeHydration" />
  </>
));
const LaterView = view(() => <p>Later body</p>);
const BrokenView = view(() => {
  throw new Error("view exploded");
});

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

const registry = createRegistry().register(addNote, home, vault, later, gallery, broken).freeze();
const manifest = buildManifest(registry, { app: "ssr-fixture" });
const bundle: RexEntryBundle = {
  registry,
  manifest,
  pages: [
    lazySet(home, {
      view: HomeView,
      states: statesFor("Notes"),
      regions: { main: HomeMain },
      overlays: {},
    }),
    lazySet(vault, { view: VaultView, states: statesFor("the vault") }),
    lazySet(later, { view: LaterView, states: statesFor("Later") }),
    lazySet(gallery, { view: GalleryView, states: statesFor("the gallery") }),
    lazySet(broken, { view: BrokenView, states: statesFor("Broken page") }),
  ],
};

const owner = actor({ id: "owner", roles: ["owner"], permissions: ["notes.write"] });
const server = createRexServer({
  registry,
  ledger: memoryLedger(),
  actor: () => owner,
  app: "ssr-fixture",
});

let assets: RexDocumentAssets;

const FONTS = [
  { family: "Inter", src: "/fonts/inter.woff2", weight: "100 900" },
  { family: 'Mono "Code"', src: "/fonts/mono.ttf", style: "italic", preload: false },
] as const;

async function buildFixtureAssets(): Promise<RexDocumentAssets> {
  rmSync(fixtureRoot, { recursive: true, force: true });
  cpSync(fixtureSource, fixtureRoot, { recursive: true });
  writeFileSync(join(fixtureRoot, "app/pages/home/home.css"), ".notes-home { color: purple; }\n");
  const viewFile = join(fixtureRoot, "app/pages/home/view.tsx");
  writeFileSync(viewFile, `import "./home.css";\n${readFileSync(viewFile, "utf8")}`);
  const result = await build({
    root: fixtureRoot,
    configFile: false,
    logLevel: "silent",
    resolve: { alias: [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }] },
    plugins: rex({ name: "ssr-fixture", compiler: false }),
    build: { write: false, minify: false, manifest: true },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const items = outputs.flatMap((output) => ("output" in output ? output.output : []));
  const asset = items.find(
    (item) => item.type === "asset" && item.fileName === CLIENT_MANIFEST_FILE,
  );
  if (asset === undefined || asset.type !== "asset") throw new Error("no client manifest was built");
  return ssrAssetsFromManifest(JSON.parse(String(asset.source)) as ViteManifest, {
    root: fixtureRoot,
  });
}

beforeAll(async () => {
  assets = await buildFixtureAssets();
  registerPageRenderer(registry, createRexRenderer({ bundle, assets, fonts: FONTS }));
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

let started: StartedRex | null = null;

afterEach(async () => {
  if (started !== null) {
    const root = started.root;
    await act(async () => {
      root.unmount();
    });
    started = null;
  }
  cleanup();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  added.length = 0;
  vi.restoreAllMocks();
});

function request(path: string): Request {
  return new Request(new URL(path, window.location.origin), { headers: { accept: "text/html" } });
}

async function readChunks(response: Response): Promise<string[]> {
  const body = response.body;
  if (body === null) throw new Error("the response has no body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return chunks;
}

function mountDocument(html: string, path: string): HTMLElement {
  window.history.replaceState(null, "", path);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const container = document.getElementById("root");
  if (container === null) throw new Error("the document has no root element");
  return container;
}

function serverFetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
  const outgoing = new Request(input, init);
  if (!outgoing.headers.has("origin")) outgoing.headers.set("origin", window.location.origin);
  return Promise.resolve(server.fetch(outgoing));
}

async function hydrate(container: HTMLElement, mismatches: HydrationMismatch[]): Promise<StartedRex> {
  let result: StartedRex | null = null;
  await act(async () => {
    result = startRexEntry(container, bundle, {
      dev: true,
      fetch: serverFetch,
      onHydrationMismatch: (mismatch) => {
        mismatches.push(mismatch);
      },
    });
  });
  if (result === null) throw new Error("startRexEntry returned nothing");
  started = result;
  return result;
}

function textOf(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

function hydrationErrors(calls: readonly unknown[][]): string[] {
  return calls
    .map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" "))
    .filter((message) => /hydrat|did not match|REX310/i.test(message));
}

function executableInlineScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>/g)]
    .map((match) => match[1] as string)
    .filter((attributes) => !/\bsrc=/.test(attributes))
    .filter((attributes) => {
      const type = /\btype="([^"]*)"/.exec(attributes)?.[1];
      return type === undefined || type === "module" || type === "text/javascript";
    });
}

describe("streaming server-side rendering", () => {
  it("streams the document with stylesheet links and preloads before the server-rendered page", async () => {
    expect(assets.pages.home).toBeDefined();
    const homeAssets = pageAssets(assets, "home");
    const pageSheets = homeAssets.stylesheets.filter((href) => href.includes("/page-home-"));
    const pageChunks = homeAssets.preloads.filter((href) => href.includes("/page-home-"));
    expect(assets.stylesheets.length).toBeGreaterThan(0);
    expect(pageSheets.length).toBeGreaterThan(0);
    expect(pageChunks.length).toBeGreaterThan(0);

    const response = await server.fetch(request("/"));
    expect(response.status).toBe(RENDER_STATUS.page);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("x-rex-page")).toBe("home");
    expect(response.body).toBeInstanceOf(ReadableStream);

    const chunks = await readChunks(response);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("</head>");
    expect(chunks[0]).not.toContain('data-rex-page="home"');

    const html = chunks.join("");
    const bodyAt = html.indexOf("<body>");
    const pageAt = html.indexOf('data-rex-page="home"');
    expect(bodyAt).toBeGreaterThan(0);
    expect(pageAt).toBeGreaterThan(bodyAt);
    for (const href of [...assets.stylesheets, ...homeAssets.stylesheets, ...pageSheets]) {
      const at = html.indexOf(`<link rel="stylesheet" href="${href}">`);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(bodyAt);
    }
    for (const href of [...homeAssets.preloads, ...pageChunks]) {
      const at = html.indexOf(`<link rel="modulepreload" href="${href}">`);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(bodyAt);
    }
    expect(html).toContain("<title>Notes</title>");
    expect(html).toContain(`<div id="root" ${SSR_ATTRIBUTE}="">`);
    expect(html).toContain("data-rex-shell");
    expect(textOf(html)).toContain("Notes home");
    expect(html).toContain('data-rex-region="home/main"');
    expect(html).not.toContain("data-rex-page-loading");

    const dataAt = html.indexOf(`<script type="${REX_DATA_MIME_TYPE}" id="${REX_DATA_ELEMENT_ID}"`);
    expect(dataAt).toBeGreaterThan(-1);
    expect(dataAt).toBeLessThan(bodyAt);
    const sidecarAt = html.indexOf(`type="${SIDECAR_MIME_TYPE}"`);
    expect(sidecarAt).toBeGreaterThan(bodyAt);
    const entryScript = assets.scripts[0] as string;
    expect(html.indexOf(`src="${entryScript}"`)).toBeGreaterThan(pageAt);

    const nonce = /<script type="application\/rex\+data" id="rex-data" nonce="([^"]+)"/.exec(html)?.[1];
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    for (const attributes of executableInlineScripts(html)) {
      expect(attributes).toContain(`nonce="${nonce}"`);
    }

    const container = mountDocument(html, "/");
    const data = readRexData(document);
    expect(data?.page).toBe("home");
    expect(data?.actor.id).toBe("owner");
    expect(data?.queries).toEqual({ mutations: [], queries: [] });
    expect(container.querySelector('[data-rex-page="home"]')).not.toBeNull();
    expect(readSidecar(container)).toMatchObject({ page: "home", state: "ready" });
  });

  it("hydrates the server-rendered page without a mismatch and invokes an action on click", async () => {
    const html = await (await server.fetch(request("/"))).text();
    const container = mountDocument(html, "/");
    const serverSidecar = readSidecar(container);
    const serverButton = container.querySelector('[data-rex-region="home/main"] button');
    expect(serverButton).not.toBeNull();
    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];

    const result = await hydrate(container, mismatches);
    expect(result.mode).toBe("hydrate");

    const button = container.querySelector('[data-rex-region="home/main"] button');
    expect(button).toBe(serverButton);
    await waitFor(() => expect(button?.getAttribute("data-rex-allowed")).toBe("true"));
    expect(window.__rex).toEqual(serverSidecar);

    await act(async () => {
      (button as HTMLButtonElement).click();
    });
    await waitFor(() => expect(added).toEqual(["Streamed note"]));

    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });

  it("renders a csr page as the shell with its loading state and renders the page on the client", async () => {
    const response = await server.fetch(request("/later"));
    expect(response.status).toBe(RENDER_STATUS.page);
    const html = await response.text();
    expect(html).toContain("data-rex-shell");
    expect(html).toContain('data-rex-page="later" data-rex-page-loading=""');
    expect(textOf(html)).not.toContain("Later body");
    expect(html).toContain(`<div id="root" ${SSR_ATTRIBUTE}="">`);

    const container = mountDocument(html, "/later");
    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    const result = await hydrate(container, mismatches);
    expect(result.mode).toBe("hydrate");

    await waitFor(() => expect(container.textContent).toContain("Later body"));
    expect(container.querySelector("[data-rex-page-loading]")).toBeNull();
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });

  it("answers 403 with the permission-denied state rendered on the server", async () => {
    const response = await server.fetch(request("/vault"));
    expect(response.status).toBe(403);
    expect(response.headers.get("x-rex-page")).toBe("vault");
    const html = await response.text();
    expect(html).toContain('data-rex-page="vault"');
    expect(textOf(html)).toContain("You cannot open the vault");
    expect(textOf(html)).not.toContain("Vault contents");
    expect(html).toContain(`<div id="root" ${SSR_ATTRIBUTE}="">`);
  });

  it("answers 404 with the not-found state for an unknown route", async () => {
    const response = await server.fetch(request("/nowhere/at-all"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-rex-page")).toBeNull();
    const html = await response.text();
    expect(html).toContain("<title>Page not found</title>");
    expect(html).toContain('data-rex-app-state="not-found"');
    expect(textOf(html)).toContain("No page matches /nowhere/at-all.");
  });

  it("answers 500 with the recoverable-error state when the page fails to render", async () => {
    const response = await server.fetch(request("/broken"));
    expect(response.status).toBe(500);
    expect(response.headers.get("x-rex-page")).toBe("broken");
    const html = await response.text();
    expect(html).toContain('data-rex-page="broken"');
    expect(textOf(html)).toContain("Broken page failed");
    expect(html).not.toContain("view exploded");
    expect(html).not.toContain(SSR_ATTRIBUTE);
    expect(html).toContain('<div id="root">');
  });

  it("leaves /rex routes and assets to the server routes", async () => {
    const health = await server.fetch(request("/rex/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const asset = await server.fetch(request("/favicon.ico"));
    expect(asset.status).toBe(404);
    expect(asset.headers.get("x-rex-render")).toBeNull();
  });
  it("emits priority image and font preloads, the font-face block and nonced scripts in the head", async () => {
    const response = await server.fetch(request("/gallery"));
    expect(response.status).toBe(RENDER_STATUS.page);
    const html = await response.text();
    const headEnd = html.indexOf("</head>");
    const bodyAt = html.indexOf("<body>");
    expect(headEnd).toBeGreaterThan(0);
    const head = html.slice(0, headEnd);

    const heroPreload = `<link rel="preload" as="image" href="${HERO_SRC}" imagesrcset="${HERO_SRCSET}" imagesizes="${HERO_SIZES}" fetchpriority="high">`;
    expect(head).toContain(heroPreload);
    expect(head).not.toContain('href="/images/thumb.avif"');
    expect(head).toContain(
      '<link rel="preload" as="font" href="/fonts/inter.woff2" type="font/woff2" crossorigin="">',
    );
    expect(head).not.toContain('as="font" href="/fonts/mono.ttf"');
    expect(head).toContain(
      '<style data-rex-fonts="">' +
        '@font-face{font-family:"Inter";src:url("/fonts/inter.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}' +
        '@font-face{font-family:"Mono \\"Code\\"";src:url("/fonts/mono.ttf") format("truetype");font-style:italic;font-display:swap}' +
        "</style>",
    );
    const firstStylesheet = html.indexOf('<link rel="stylesheet"');
    expect(html.indexOf(heroPreload)).toBeLessThan(firstStylesheet);
    expect(html.indexOf("<style data-rex-fonts")).toBeLessThan(firstStylesheet);

    const body = html.slice(bodyAt);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const hero = parsed.body.querySelector(`img[src="${HERO_SRC}"]`);
    expect(hero?.getAttribute("fetchpriority")).toBe("high");
    expect(hero?.getAttribute("loading")).toBe("eager");
    expect(hero?.getAttribute("width")).toBe("1200");
    expect(hero?.getAttribute("height")).toBe("630");
    const thumb = parsed.body.querySelector('img[src="/images/thumb.avif"]');
    expect(thumb?.getAttribute("loading")).toBe("lazy");
    expect(thumb?.getAttribute("decoding")).toBe("async");
    expect(thumb?.hasAttribute("fetchpriority")).toBe(false);

    const nonce = /<script type="application\/rex\+data" id="rex-data" nonce="([^"]+)"/.exec(html)?.[1];
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    const widget = parsed.body.querySelector(`script[src="${WIDGET_SRC}"]`);
    expect(widget?.getAttribute(SCRIPT_ATTRIBUTE)).toBe("beforeHydration");
    expect(widget?.getAttribute("nonce")).toBe(nonce);
    expect(body.indexOf(`src="${WIDGET_SRC}"`)).toBeLessThan(body.indexOf(`src="${assets.scripts[0] as string}"`));

    const other = await (await server.fetch(request("/"))).text();
    expect(other).toContain('<style data-rex-fonts="">');
    expect(other).not.toContain(heroPreload);
  });
});

const subscribe = action("subscribe", {
  input: z.object({ email: text({ min: 3, max: 120 }) }),
  output: z.object({ email: text() }),
  policy: can("notes.write"),
  effect: "reversible",
  label: "Subscribe",
  handler: (input) => ({ email: input.email }),
});

const signup = page("signup", {
  route: "/signup",
  actions: [subscribe],
  chrome: { title: "Sign up" },
  regions: ["form"],
});

const SignupForm = region("form", () => <ActionForm action={subscribe} />);
const signupRegistry = createRegistry().register(subscribe, signup).freeze();
const signupBundle: RexEntryBundle = {
  registry: signupRegistry,
  manifest: buildManifest(signupRegistry, { app: "ssr-csrf" }),
  pages: [
    lazySet(signup, {
      view: view(() => <SignupForm />),
      states: statesFor("Sign up"),
      regions: { form: SignupForm },
      overlays: {},
    }),
  ],
};
let signupRenderer: RexPageRenderer | null = null;

function signupRequest(): Request {
  return new Request(new URL("/signup", window.location.origin), { headers: { accept: "text/html" } });
}

async function renderSignup(request: Request): Promise<string> {
  signupRenderer ??= createRexRenderer({ bundle: signupBundle, assets });
  const result = await signupRenderer.render(request, {
    actor: owner,
    density: DEFAULT_DENSITY,
    nonce: "0123456789abcdef0123456789abcdef",
  });
  expect(result.kind).toBe("page");
  return new Response(result.body).text();
}

function csrfFieldOf(html: string): string | null {
  const input = new RegExp(`<input type="hidden" name="${CSRF_FIELD}" value="([^"]*)"/>`).exec(html);
  return input === null ? null : (input[1] as string);
}

describe("the CSRF token in server-rendered forms", () => {
  afterEach(() => {
    document.cookie = `${CSRF_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("renders the rex-csrf token granted to the document request into the form", async () => {
    const request = signupRequest();
    const grant = ensureCsrfToken(request);
    expect(grant.setCookie).toMatch(new RegExp(`^${CSRF_COOKIE}=${grant.token}; Path=/; SameSite=Lax$`));
    bindCsrfGrant(request, grant);
    const html = await renderSignup(request);
    expect(html).toMatch(/<form\b[^>]*\baction="\/rex\/form\/subscribe"[^>]*\bmethod="post"/);
    expect(csrfFieldOf(html)).toBe(grant.token);
  });

  it("renders an empty token when no grant is bound, as prerendering does", async () => {
    expect(csrfFieldOf(await renderSignup(signupRequest()))).toBe("");
  });

  it("hydrates the server-rendered form with the cookie's token and no mismatch", async () => {
    const request = signupRequest();
    const token = "ab".repeat(32);
    bindCsrfGrant(request, { token, setCookie: null });
    const html = await renderSignup(request);
    expect(csrfFieldOf(html)).toBe(token);
    document.cookie = `${CSRF_COOKIE}=${token}; Path=/`;
    const container = mountDocument(html, "/signup");
    const errors = vi.spyOn(console, "error");
    const mismatches: HydrationMismatch[] = [];
    await act(async () => {
      started = startRexEntry(container, signupBundle, {
        dev: true,
        fetch: serverFetch,
        onHydrationMismatch: (mismatch) => {
          mismatches.push(mismatch);
        },
      });
    });
    expect(started?.mode).toBe("hydrate");
    const field = container.querySelector<HTMLInputElement>(`input[name="${CSRF_FIELD}"]`);
    expect(field?.value).toBe(token);
    expect(mismatches).toEqual([]);
    expect(hydrationErrors(errors.mock.calls)).toEqual([]);
  });
});
