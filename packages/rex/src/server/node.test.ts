import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { boolean, z } from "../core/schema.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { createRexServer, memoryLedger, type RegistryRouterClient } from "./index.ts";
import { isApiPath, isPageRoutePath, startNodeServer, type RunningNodeServer } from "./node.ts";

const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const APP_JS = 'console.log("rex");';

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: z.string() }),
  actions: [toggleDust],
});

const source = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };

describe("startNodeServer", () => {
  let clientDir: string;
  let running: RunningNodeServer;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), "rex-node-"));
    mkdirSync(join(clientDir, "assets"));
    mkdirSync(join(clientDir, "rex"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    writeFileSync(join(clientDir, "assets", "app.js"), APP_JS);
    writeFileSync(join(clientDir, "rex", "health"), "shadowed");
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
      app: "node-test",
    });
    running = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
  });

  afterAll(async () => {
    await running.close();
    rmSync(clientDir, { recursive: true, force: true });
  });

  it("listens on an ephemeral port", () => {
    expect(running.port).toBeGreaterThan(0);
    expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
  });

  it("serves client assets from clientDir", async () => {
    const response = await fetch(`${running.url}/assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(await response.text()).toBe(APP_JS);
  });

  it("serves index.html at the root and as the fallback for page routes", async () => {
    for (const path of ["/", "/portfolio/acc-1", "/send", "/portfolio/acc-1?act=toggle-dust"]) {
      const response = await fetch(`${running.url}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain("text/html");
      expect(await response.text(), path).toBe(INDEX_HTML);
    }
  });

  it("returns 404 for a missing asset instead of the page fallback", async () => {
    const response = await fetch(`${running.url}/assets/missing.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toBe(INDEX_HTML);
  });

  it("leaves /rex/* to the API even when clientDir has a matching file", async () => {
    const health = await fetch(`${running.url}/rex/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const manifest = await fetch(`${running.url}/rex/manifest`);
    expect(await manifest.text()).toBe(
      stableStringify(buildManifest(source, { app: "node-test" })),
    );
    const unknown = await fetch(`${running.url}/rex/unknown`);
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).not.toBe(INDEX_HTML);
  });

  it("runs actions over RPC through the node server", async () => {
    const client: RegistryRouterClient<typeof source> = createORPCClient(
      new RPCLink({ url: `${running.url}/rex/rpc` }),
    );
    await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({ hide: true });
  });

  it("does not serve the page fallback for non-GET requests", async () => {
    const response = await fetch(`${running.url}/portfolio/acc-1`, { method: "POST" });
    expect(response.status).toBe(404);
  });

  it("refuses a missing client directory or index.html", async () => {
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
    });
    expect(() => startNodeServer(app, { port: 0, clientDir: join(clientDir, "nope") })).toThrow(
      "is not a directory",
    );
    expect(() => startNodeServer(app, { port: 0, clientDir: join(clientDir, "assets") })).toThrow(
      "has no index.html",
    );
    expect(() => startNodeServer(app, { port: -1, clientDir })).toThrow(RangeError);
  });

  it("classifies API and page route paths", () => {
    expect(isApiPath("/rex")).toBe(true);
    expect(isApiPath("/rex/rpc/send")).toBe(true);
    expect(isApiPath("/rexy")).toBe(false);
    expect(isPageRoutePath("/portfolio/acc-1")).toBe(true);
    expect(isPageRoutePath("/assets/app.js")).toBe(false);
  });
});

describe("startNodeServer close", () => {
  it("stops accepting connections after close", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "rex-node-close-"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
    });
    const server = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
    expect((await fetch(`${server.url}/rex/health`)).status).toBe(200);
    await server.close();
    await expect(fetch(`${server.url}/rex/health`)).rejects.toThrow();
    rmSync(clientDir, { recursive: true, force: true });
  });
});
