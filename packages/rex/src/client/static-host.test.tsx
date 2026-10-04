// @vitest-environment node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Browser, Window, type BrowserPage } from "happy-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CLIENT_DIR, DIST_DIR, buildApp, type BuildResult } from "../cli/commands/build.ts";
import { STATIC_HOST_ENV_KEY } from "../vite/entry-module.ts";
import { REX_MANIFEST_PATH, REX_RPC_PATH } from "./context.ts";
import { REX_FORM_PREFIX } from "./form.tsx";
import { STATIC_LOADER_DEFAULTS, isStaticHost, navigateDocument } from "./static-host.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const demoRoot = join(repoRoot, "examples", "demo");
const serveStaticModule = join(repoRoot, "tools", "serve-static.mjs");
const WALK_TIMEOUT_MS = 480_000;
const PAGE_TIMEOUT_MS = 60_000;

type StaticHandler = (request: IncomingMessage, response: ServerResponse) => void;

interface ServeStaticModule {
  createStaticHandler(root: string): StaticHandler;
}

interface ServedRequest {
  readonly method: string;
  readonly path: string;
  status: number | null;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the static host flag", () => {
  it("reads the REX_STATIC_HOST define the static build sets", () => {
    expect(isStaticHost()).toBe(false);
    vi.stubEnv(STATIC_HOST_ENV_KEY, "true");
    expect(isStaticHost()).toBe(true);
    vi.stubEnv(STATIC_HOST_ENV_KEY, "false");
    expect(isStaticHost()).toBe(false);
  });

  it("keeps loader data for the life of the document", () => {
    expect(STATIC_LOADER_DEFAULTS.staleTime).toBe(Number.POSITIVE_INFINITY);
    expect(STATIC_LOADER_DEFAULTS.refetchOnWindowFocus).toBe(false);
    expect(STATIC_LOADER_DEFAULTS.refetchOnReconnect).toBe(false);
    expect(STATIC_LOADER_DEFAULTS.refetchOnMount).toBe(false);
    expect(Object.isFrozen(STATIC_LOADER_DEFAULTS)).toBe(true);
  });

  it("navigates a document by assigning or replacing its location", async () => {
    const window = new Window({ url: "http://static.test/start" });
    try {
      const historyLength = window.history.length;
      navigateDocument("/guide?step=2", { replace: false }, window.location);
      await vi.waitFor(() => expect(window.location.href).toBe("http://static.test/guide?step=2"));
      navigateDocument("/about", { replace: true }, window.location);
      await vi.waitFor(() => expect(window.location.href).toBe("http://static.test/about"));
      expect(window.history.length).toBeGreaterThanOrEqual(historyLength);
    } finally {
      await window.happyDOM.close();
    }
  });
});

function isServerRoute(path: string): boolean {
  const { pathname } = new URL(path, "http://static.test");
  return (
    pathname === REX_MANIFEST_PATH ||
    pathname.startsWith(REX_RPC_PATH) ||
    pathname.startsWith(`${REX_FORM_PREFIX}/`)
  );
}

function assetPaths(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="(\/[^"]*)"/g)) {
    found.add(match[1] as string);
  }
  return [...found].sort();
}

function renderedPage(page: BrowserPage): string | null {
  return (
    page.mainFrame.document.querySelector("[data-rex-page]")?.getAttribute("data-rex-page") ?? null
  );
}

describe("a static deployment of the demo", { timeout: WALK_TIMEOUT_MS }, () => {
  let built: BuildResult;
  let server: Server;
  let origin: string;
  let browser: Browser;
  const served: ServedRequest[] = [];

  beforeAll(async () => {
    built = await buildApp(demoRoot, { logLevel: "silent", target: "static" });
    const tools = (await import(
      /* @vite-ignore */ pathToFileURL(serveStaticModule).href
    )) as ServeStaticModule;
    const handler = tools.createStaticHandler(join(demoRoot, DIST_DIR, CLIENT_DIR));
    server = createServer((request, response) => {
      const entry: ServedRequest = {
        method: request.method ?? "GET",
        path: request.url ?? "/",
        status: null,
      };
      served.push(entry);
      const answered = () => {
        entry.status = response.statusCode;
      };
      response.on("finish", answered);
      response.on("close", answered);
      handler(request, response);
    });
    await new Promise<void>((listening) => server.listen(0, "127.0.0.1", () => listening()));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    browser = new Browser();
  }, WALK_TIMEOUT_MS);

  afterAll(async () => {
    await browser?.close();
    await new Promise<void>((closed) =>
      server === undefined ? closed() : server.close(() => closed()),
    );
  });

  async function walked(label: string): Promise<readonly ServedRequest[]> {
    await vi.waitFor(() => expect(served.filter((entry) => entry.status === null)).toEqual([]), {
      timeout: PAGE_TIMEOUT_MS,
      interval: 50,
    });
    const requests = served.splice(0);
    const failed = requests.filter((entry) => (entry.status as number) >= 400);
    expect(failed, `${label}: failed requests`).toEqual([]);
    const answered = requests.filter((entry) => isServerRoute(entry.path));
    expect(answered, `${label}: requests a static host cannot answer`).toEqual([]);
    expect(
      requests.filter((entry) => entry.method !== "GET"),
      `${label}: requests other than GET`,
    ).toEqual([]);
    return requests;
  }

  async function open(path: string): Promise<BrowserPage> {
    const page = browser.newPage();
    const response = await page.goto(`${origin}${path}`);
    expect(response?.status, path).toBe(200);
    await page.waitUntilComplete();
    return page;
  }

  it("builds the demo for a static host with an ssg page and a static page to walk", () => {
    expect(built.target).toBe("static");
    expect(built.apiOrigin).toBeNull();
    const modes = built.prerendered.map((entry) => entry.render);
    expect(modes).toContain("ssg");
    expect(modes).toContain("static");
  });

  it("loads every prerendered page and every file it references with no failed request", async () => {
    for (const entry of built.prerendered) {
      const page = await open(entry.path);
      try {
        expect(renderedPage(page), entry.path).toBe(entry.page);
        const html = page.content;
        expect(html.includes('<script type="module"'), entry.path).toBe(entry.render === "ssg");
        for (const asset of assetPaths(html)) {
          const response = await fetch(`${origin}${asset}`);
          expect(response.status, asset).toBe(200);
          await response.arrayBuffer();
        }
        const requests = await walked(entry.path);
        expect(requests.length, entry.path).toBeGreaterThan(1);
      } finally {
        await page.close();
      }
    }
  });

  it("follows a shell navigation link from an ssg page to another prerendered page as a document", async () => {
    const from = built.prerendered.find((entry) => entry.render === "ssg");
    expect(from, "the demo prerenders an ssg page").toBeDefined();
    const start = from as NonNullable<typeof from>;
    const targets = built.prerendered.filter((entry) => entry.page !== start.page);
    const page = await open(start.path);
    try {
      const document = page.mainFrame.document;
      const anchor = [...document.querySelectorAll("a[data-rex-nav]")].find((candidate) =>
        targets.some((entry) => entry.page === candidate.getAttribute("data-rex-nav")),
      );
      expect(
        anchor,
        `a navigation link from ${start.path} to another prerendered page`,
      ).toBeDefined();
      const link = anchor as NonNullable<typeof anchor>;
      const target = targets.find(
        (entry) => entry.page === link.getAttribute("data-rex-nav"),
      ) as NonNullable<(typeof targets)[number]>;
      expect(link.getAttribute("href")).toBe(target.path);
      await walked(start.path);

      (link as unknown as { click(): void }).click();
      await vi.waitFor(() => expect(renderedPage(page)).toBe(target.page), {
        timeout: PAGE_TIMEOUT_MS,
        interval: 50,
      });
      await page.waitUntilComplete();
      expect(new URL(page.mainFrame.url).pathname.replace(/\/$/, "")).toBe(target.path);
      const requests = await walked(`${start.path} -> ${target.path}`);
      expect(requests.some((entry) => entry.path.startsWith(target.path))).toBe(true);
    } finally {
      await page.close();
    }
  });
});
