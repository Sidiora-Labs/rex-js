import { spawn, type ChildProcess } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SSR_ATTRIBUTE } from "../client/hydrate.ts";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean } from "../schema/index.ts";
import { z } from "zod/mini";
import { STATE_EXPORT_NAMES } from "../core/states.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { SIDECAR_MIME_TYPE } from "../core/protocol.ts";
import { buildApp, SERVER_FILE, SERVING_PREFIX } from "../cli/commands/build.ts";
import { HOME_PAGE } from "../cli/commands/new.ts";
import { EXIT_OK, run, type RexCliIO } from "../cli/index.ts";
import { CSP_HEADER, createRexServer, memoryLedger, type RegistryRouterClient } from "./index.ts";
import {
  isApiPath,
  isPageRoutePath,
  startNodeServer,
  type RunningNodeServer,
} from "./adapters/node.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "./routes/render.ts";
import { createRexRenderer, registerPageRenderer } from "./ssr.ts";

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
      new RPCLink({ url: `${running.url}/rex/rpc`, headers: { origin: running.url } }),
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
    expect(() => startNodeServer(app, { port: -1, clientDir })).toThrow(expect.objectContaining({ name: "RexError", code: "REX407" }));
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

describe("startNodeServer with a registered page renderer", () => {
  const ledger = memoryLedger();
  const registry = createRegistry().register(toggleDust, portfolio).freeze();
  const PortfolioView = view<{ account: string }>(({ params }) =>
    createElement("p", null, `Holdings of ${params.account}`),
  );
  let clientDir: string;
  let running: RunningNodeServer;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), "rex-node-ssr-"));
    mkdirSync(join(clientDir, "assets"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    writeFileSync(join(clientDir, "assets", "app.js"), APP_JS);
    registerPageRenderer(
      registry,
      createRexRenderer({
        bundle: {
          registry,
          manifest: buildManifest(registry, { app: "node-ssr" }),
          pages: [lazySet(portfolio, { view: PortfolioView, states: statesFor("Portfolio") })],
        },
      }),
    );
    const app = createRexServer({
      registry,
      ledger,
      actor: () => actor({ id: "alice" }),
      app: "node-ssr",
    });
    running = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
  });

  afterAll(async () => {
    await running.close();
    rmSync(clientDir, { recursive: true, force: true });
  });

  it("renders page routes on the server instead of serving index.html", async () => {
    const response = await fetch(`${running.url}/portfolio/acc-1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get(RENDER_KIND_HEADER)).toBe("page");
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("portfolio");
    const html = await response.text();
    expect(html).not.toBe(INDEX_HTML);
    expect(html).toContain(SSR_ATTRIBUTE);
    expect(html).toContain("Holdings of acc-1");
  });

  it("answers an unknown page route with the server-rendered 404 and no index.html fallback", async () => {
    for (const path of ["/", "/nowhere"]) {
      const response = await fetch(`${running.url}${path}`);
      expect(response.status, path).toBe(404);
      expect(response.headers.get(RENDER_KIND_HEADER), path).toBe("not-found");
      expect(await response.text(), path).not.toBe(INDEX_HTML);
    }
  });

  it("still serves client assets first and leaves /rex/* to the API", async () => {
    const asset = await fetch(`${running.url}/assets/app.js`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe(APP_JS);
    expect((await fetch(`${running.url}/assets/missing.js`)).status).toBe(404);
    const health = await fetch(`${running.url}/rex/health`);
    expect(await health.json()).toEqual({ status: "ok" });
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const BUILT_APP = "node-built-app";
const BUILT_SERVER_TIMEOUT_MS = 240_000;
const SERVER_START_TIMEOUT_MS = 30_000;

function silentIO(cwd: string): RexCliIO {
  return { cwd, out: () => {}, err: () => {} };
}

function linkPackage(root: string, name: string, source: string): void {
  const destination = join(root, "node_modules", name);
  mkdirSync(dirname(destination), { recursive: true });
  symlinkSync(realpathSync(source), destination, "dir");
}

function installRuntimeCopy(cwd: string, root: string): void {
  const copy = join(cwd, "rex-runtime");
  mkdirSync(copy);
  cpSync(join(packageRoot, "package.json"), join(copy, "package.json"));
  cpSync(join(packageRoot, "src"), join(copy, "src"), {
    recursive: true,
    filter: (source) => basename(source) !== "fixtures" && !/\.test\.tsx?$/.test(source),
  });
  symlinkSync(realpathSync(join(packageRoot, "node_modules")), join(copy, "node_modules"), "dir");
  linkPackage(root, "@sidioralabs/rex", copy);
}

function installDependencies(root: string): void {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
  };
  for (const name of [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]) {
    if (name === "@sidioralabs/rex") continue;
    const source = join(packageRoot, "node_modules", name);
    expect(existsSync(source), `${name} is resolvable from the rex package`).toBe(true);
    linkPackage(root, name, source);
  }
}

function waitForServing(child: ChildProcess): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      reject(new Error(`node ${SERVER_FILE} did not start: ${stdout}${stderr}`));
    }, SERVER_START_TIMEOUT_MS);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      const line = stdout.split("\n").find((entry) => entry.startsWith(SERVING_PREFIX));
      if (line !== undefined) {
        clearTimeout(timer);
        resolvePromise(line.slice(SERVING_PREFIX.length).trim());
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`node ${SERVER_FILE} exited with ${code}: ${stdout}${stderr}`));
    });
  });
}

describe(
  "node dist/server.js built by rex build for an app that resolves its own copy of the runtime",
  { timeout: BUILT_SERVER_TIMEOUT_MS },
  () => {
    let cwd: string;
    let clientDir: string;
    let child: ChildProcess | null = null;
    let url: string;

    beforeAll(async () => {
      cwd = mkdtempSync(join(tmpdir(), "rex-node-built-"));
      expect(await run(["new", BUILT_APP, "--ui", "none"], silentIO(cwd))).toBe(EXIT_OK);
      const root = join(cwd, BUILT_APP);
      installRuntimeCopy(cwd, root);
      installDependencies(root);
      const built = await buildApp(root, { logLevel: "silent" });
      expect(built.serverFile).not.toBeNull();
      clientDir = built.clientDir;
      child = spawn(process.execPath, [built.serverFile as string], {
        cwd: root,
        env: { ...process.env, PORT: "0", HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      url = await waitForServing(child);
    }, BUILT_SERVER_TIMEOUT_MS);

    afterAll(() => {
      child?.kill("SIGKILL");
      rmSync(cwd, { recursive: true, force: true });
    });

    it("answers a page path with the streamed document, the sidecar and the nonce CSP header", async () => {
      const response = await fetch(`${url}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get(RENDER_KIND_HEADER)).toBe("page");
      expect(response.headers.get(RENDER_PAGE_HEADER)).toBe(HOME_PAGE);
      const policy = response.headers.get(CSP_HEADER);
      expect(policy).not.toBeNull();
      const nonce = /'nonce-([^']+)'/.exec(policy as string)?.[1];
      expect(nonce).toBeDefined();
      const html = await response.text();
      expect(html).not.toBe(readFileSync(join(clientDir, "index.html"), "utf8"));
      expect(html).toContain(SSR_ATTRIBUTE);
      expect(html).toContain(`type="${SIDECAR_MIME_TYPE}"`);
      expect(html).toContain(`nonce="${nonce as string}"`);
    });

    it("lets non-page paths fall through to the client directory", async () => {
      const index = readFileSync(join(clientDir, "index.html"), "utf8");
      const entry = /src="\/(assets\/[^"]+\.js)"/.exec(index)?.[1];
      expect(entry).toBeDefined();
      const asset = await fetch(`${url}/${entry as string}`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get("content-type")).toContain("javascript");
      expect(asset.headers.get(RENDER_KIND_HEADER)).toBeNull();
      expect(await asset.text()).toBe(readFileSync(join(clientDir, entry as string), "utf8"));
      expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
    });
  },
);
