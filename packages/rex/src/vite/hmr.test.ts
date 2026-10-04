import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, normalizePath, type HotPayload, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RexAppBundle } from "./app-module.ts";
import {
  PAGE_RELOAD_CODE,
  REX_NOTICE_EVENT,
  pageIdOfDeclaration,
  pageReloadNotice,
  type RexHmrNotice,
} from "./hmr.ts";
import { rex } from "./index.ts";
import { APP_MODULE_ID, RESOLVED_APP_MODULE_ID } from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const packageModules = join(here, "..", "..", "node_modules");
const coreEntry = join(here, "..", "index.ts");
const alias = [
  { find: /^@sidioralabs\/rex$/, replacement: coreEntry },
  { find: /^@sidioralabs\/rex\/schema$/, replacement: join(here, "..", "schema", "index.ts") },
];

const APP_URL = "/@id/__x00__rex:app";
const HOME = "/app/pages/home";
const PART_URL = `${HOME}/regions/list/parts/NoteRow.tsx`;
const REGION_URL = `${HOME}/regions/composer/region.tsx`;
const HOME_PAGE_URL = `${HOME}/page.ts`;
const HOME_CHUNK_URLS = [
  `${HOME}/view.tsx`,
  `${HOME}/states.tsx`,
  `${HOME}/regions/list/region.tsx`,
  PART_URL,
  REGION_URL,
  `${HOME}/overlays/NoteSheet.tsx`,
];
const NOTE_VIEW_URL = "/app/pages/note/view.tsx";
const BROWSER_URLS = ["/@rex/entry", APP_URL, HOME_PAGE_URL, ...HOME_CHUNK_URLS, NOTE_VIEW_URL];

describe("pageIdOfDeclaration", () => {
  const appPath = "/srv/site/app";

  it("names the page whose page.ts changed", () => {
    expect(pageIdOfDeclaration("/srv/site/app/pages/home/page.ts", appPath)).toBe("home");
    expect(pageIdOfDeclaration("/srv/site/app/pages/note/page.ts?t=1", appPath)).toBe("note");
  });

  it("ignores views, states, regions, parts and files outside the pages folder", () => {
    for (const file of [
      "/srv/site/app/pages/home/view.tsx",
      "/srv/site/app/pages/home/states.tsx",
      "/srv/site/app/pages/home/regions/list/region.tsx",
      "/srv/site/app/pages/home/regions/list/parts/page.ts",
      "/srv/site/app/pages/page.ts",
      "/srv/site/app/actions/page.ts",
      "/srv/other/app/pages/home/page.ts",
    ]) {
      expect(pageIdOfDeclaration(file, appPath)).toBeNull();
    }
  });

  it("builds the REX320 notice naming the page and its file", () => {
    const notice = pageReloadNotice("home", "app/pages/home/page.ts");
    expect(notice.code).toBe("REX320");
    expect(notice.page).toBe("home");
    expect(notice.file).toBe("app/pages/home/page.ts");
    expect(notice.message.startsWith('REX320 page "home" ')).toBe(true);
    expect(notice.message).toContain("app/pages/home/page.ts");
  });
});

describe("hot module replacement on the dev server", () => {
  let root: string;
  let vite: ViteDevServer;
  let base: string;
  let socket: WebSocket;
  const messages: HotPayload[] = [];

  const file = (url: string) => join(root, url);
  const edit = (url: string, from: string, to: string) => {
    const source = readFileSync(file(url), "utf8");
    expect(source).toContain(from);
    writeFileSync(file(url), source.replace(from, to));
  };
  const clientNode = (url: string) =>
    url === APP_URL
      ? vite.environments.client.moduleGraph.getModuleById(RESOLVED_APP_MODULE_ID)
      : vite.environments.client.moduleGraph.getModuleById(normalizePath(file(url)));
  const loadInBrowserOrder = async () => {
    for (const url of BROWSER_URLS) {
      const response = await fetch(`${base}${url}`);
      expect(response.status, url).toBe(200);
      await response.text();
    }
  };
  const waitForMessage = async (from: number, match: (payload: HotPayload) => boolean) => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const found = messages.slice(from).find(match);
      if (found !== undefined) return found;
      await new Promise((done) => setTimeout(done, 25));
    }
    throw new Error(`no HMR message matched; received ${JSON.stringify(messages.slice(from))}`);
  };
  const loadBundle = async () => (await vite.ssrLoadModule(APP_MODULE_ID)) as RexAppBundle;

  beforeAll(async () => {
    root = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), "rex-hmr-"))));
    cpSync(fixtureRoot, root, { recursive: true });
    symlinkSync(packageModules, join(root, "node_modules"), "dir");
    vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      optimizeDeps: { noDiscovery: true },
      server: { host: "127.0.0.1", port: 0 },
      plugins: [rex({ name: "fixture" })],
    });
    await vite.listen();
    const address = vite.httpServer?.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
    const token = encodeURIComponent(vite.config.webSocketToken);
    socket = new WebSocket(`ws://127.0.0.1:${address.port}/?token=${token}`, "vite-hmr");
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as HotPayload);
    });
    await waitForMessage(0, (payload) => payload.type === "connected");
  }, 60_000);

  afterAll(async () => {
    socket?.close();
    await vite?.close();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  });

  it("sends an HMR update, not a full reload, when a part is edited", async () => {
    await loadInBrowserOrder();
    expect(clientNode(PART_URL)?.isSelfAccepting).toBe(true);

    const from = messages.length;
    edit(PART_URL, "<li>", '<li data-hmr="part">');
    const update = await waitForMessage(
      from,
      (payload) =>
        payload.type === "update" && payload.updates.some((entry) => entry.path === PART_URL),
    );
    if (update.type !== "update") throw new Error(`expected an update, got ${update.type}`);
    expect(update.updates.map((entry) => [entry.type, entry.path, entry.acceptedPath])).toEqual([
      ["js-update", PART_URL, PART_URL],
    ]);
    const received = messages.slice(from);
    expect(received.filter((payload) => payload.type === "full-reload")).toEqual([]);
    expect(
      received.filter((payload) => payload.type === "custom" && payload.event === REX_NOTICE_EVENT),
    ).toEqual([]);
  }, 60_000);

  it("sends an HMR update, not a full reload, when a region is edited", async () => {
    await loadInBrowserOrder();
    expect(clientNode(REGION_URL)?.isSelfAccepting).toBe(true);

    const from = messages.length;
    edit(REGION_URL, "data-rex-region", 'data-hmr="region" data-rex-region');
    const update = await waitForMessage(
      from,
      (payload) =>
        payload.type === "update" && payload.updates.some((entry) => entry.path === REGION_URL),
    );
    if (update.type !== "update") throw new Error(`expected an update, got ${update.type}`);
    expect(update.updates.map((entry) => [entry.type, entry.path, entry.acceptedPath])).toEqual([
      ["js-update", REGION_URL, REGION_URL],
    ]);
    expect(messages.slice(from).filter((payload) => payload.type === "full-reload")).toEqual([]);
  }, 60_000);

  it("invalidates rex:app and the page chunk and reloads with a REX320 notice when page.ts is edited", async () => {
    await loadInBrowserOrder();
    const before = await loadBundle();
    expect(before.pages.find((entry) => entry.id === "home")?.page.chrome.title).toBe("Notes");
    for (const url of [APP_URL, HOME_PAGE_URL, ...HOME_CHUNK_URLS, NOTE_VIEW_URL]) {
      expect(clientNode(url)?.transformResult, url).not.toBeNull();
    }
    const ssrGraph = vite.environments.ssr.moduleGraph;
    expect(ssrGraph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).not.toBeNull();

    const from = messages.length;
    edit(HOME_PAGE_URL, 'title: "Notes"', 'title: "Notebook"');
    const reload = await waitForMessage(from, (payload) => payload.type === "full-reload");
    expect(reload).toEqual({ type: "full-reload", path: "*" });

    const received = messages.slice(from);
    const notices = received.filter(
      (payload) => payload.type === "custom" && payload.event === REX_NOTICE_EVENT,
    );
    expect(notices).toHaveLength(1);
    const notice = notices[0];
    if (notice?.type !== "custom") throw new Error("expected a custom notice payload");
    const data = notice.data as RexHmrNotice;
    expect(data).toEqual(pageReloadNotice("home", "app/pages/home/page.ts"));
    expect(data.code).toBe(PAGE_RELOAD_CODE);
    expect(data.message).toContain('REX320 page "home"');
    expect(received.indexOf(notice)).toBeLessThan(received.indexOf(reload));
    expect(received.filter((payload) => payload.type === "update")).toEqual([]);
    expect(received.filter((payload) => payload.type === "full-reload")).toHaveLength(1);

    for (const url of [APP_URL, HOME_PAGE_URL, ...HOME_CHUNK_URLS]) {
      expect(clientNode(url)?.transformResult, url).toBeNull();
    }
    expect(clientNode(NOTE_VIEW_URL)?.transformResult).not.toBeNull();
    expect(ssrGraph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).toBeNull();

    const after = await loadBundle();
    expect(after.pages.find((entry) => entry.id === "home")?.page.chrome.title).toBe("Notebook");
    expect(after.manifest.pages.find((entry) => entry.id === "home")?.chrome.title).toBe(
      "Notebook",
    );
  }, 60_000);
});
