import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { Suspense, createElement, use, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import {
  configServer,
  configServerOptions,
  defineConfig,
  readConfigExport,
} from "../core/config.ts";
import { createRegistry } from "../core/registry.ts";
import { generateServerEntry, serverRuntimePaths } from "../cli/commands/build.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { boolean, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { escapeInlineJson } from "../core/serialize.ts";
import { CSP_NONCE_META_PROPERTY, nonceHook } from "../vite/nonce.ts";
import {
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  MANIFEST_PATH,
  createRexServer,
  memoryLedger,
  requestNonce,
  type Ledger,
  type RexServerOptions,
} from "./index.ts";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean(), by: text() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input, ctx) => ({ hide: input.hide, by: ctx.actor.id }),
});

const portfolio = page("portfolio", {
  route: "/",
  actions: [toggleDust],
  regions: ["balances"],
});

const source = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };

const alice = actor({ id: "alice" });

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer alice" ? alice : anonymousActor;
}

const ORIGIN = "http://rex.test";
const PARTNER = "https://partner.example";
const TAURI = "tauri://localhost";
const CAPACITOR = "capacitor://localhost";

type SecurityOptions = Pick<RexServerOptions<typeof toggleDust>, "security" | "client">;

function serverWith(ledger: Ledger, options: SecurityOptions = {}) {
  return createRexServer({
    registry: source,
    ledger,
    actor: resolveActor,
    app: "demo",
    ...options,
  });
}

function post(path: string, origin?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: "Bearer alice",
  };
  if (origin !== undefined) headers.origin = origin;
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: { hide: true } }),
  });
}

function cspNonce(policy: string | null): string {
  const match = /'nonce-([^']+)'/.exec(policy ?? "");
  if (match?.[1] === undefined) throw new Error(`no nonce in policy ${String(policy)}`);
  return match[1];
}

function strictPolicy(nonce: string, connect = "'self'"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect}`,
    "img-src 'self' data: blob:",
  ].join("; ");
}

interface ScriptTag {
  readonly tag: string;
  readonly external: boolean;
  readonly nonce: string | null;
}

function scriptTags(html: string): ScriptTag[] {
  return [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => {
    const attributes = match[1] ?? "";
    return {
      tag: match[0],
      external: /\ssrc\s*=/i.test(attributes),
      nonce: /\snonce="([^"]*)"/i.exec(attributes)?.[1] ?? null,
    };
  });
}

function delayed<T>(value: T, ms: number): Promise<T> {
  return new Promise((done) => setTimeout(() => done(value), ms));
}

function Balance({ amount }: { readonly amount: Promise<string> }): ReactNode {
  return createElement("p", { "data-rex": "region:balances" }, use(amount));
}

function documentFor(nonce: string, body: ReactNode): ReactNode {
  return createElement(
    "html",
    { lang: "en" },
    createElement("head", null, createElement("title", null, "Portfolio")),
    createElement(
      "body",
      null,
      createElement("main", { id: "root", "data-rex-ssr": "" }, body),
      createElement("script", {
        type: "application/rex+data",
        nonce,
        dangerouslySetInnerHTML: { __html: escapeInlineJson({ balances: ["</script>"] }) },
      }),
    ),
  );
}

describe("security middleware", () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = memoryLedger();
  });

  describe("Origin check on POST to /rex/*", () => {
    it("rejects a POST without an Origin with 403 before the action runs", async () => {
      const response = await serverWith(ledger).fetch(post("/rex/rpc/toggle-dust"));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        code: "FORBIDDEN",
        message:
          "POST /rex/rpc/toggle-dust was refused for a missing Origin; same-origin requests and origins listed in security.origins are allowed",
      });
      expect(await ledger.list()).toEqual([]);
    });

    it("rejects a POST from a foreign or opaque Origin with 403", async () => {
      const app = serverWith(ledger);
      const foreign = await app.fetch(post("/rex/rpc/toggle-dust", "https://evil.example"));
      expect(foreign.status).toBe(403);
      expect(((await foreign.json()) as { message: string }).message).toContain(
        "Origin https://evil.example",
      );
      expect((await app.fetch(post("/rex/rpc/toggle-dust", "null"))).status).toBe(403);
      expect((await app.fetch(post("/rex/flow/start", "https://evil.example"))).status).toBe(403);
      expect(await ledger.list()).toEqual([]);
    });

    it("accepts a same-origin POST and runs the action", async () => {
      const response = await serverWith(ledger).fetch(post("/rex/rpc/toggle-dust", ORIGIN));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ json: { hide: true, by: "alice" } });
      expect((await ledger.list()).map((record) => record.actionId)).toEqual(["toggle-dust"]);
    });

    it("accepts origins listed in security.origins and still rejects others", async () => {
      const app = serverWith(ledger, { security: { origins: [PARTNER] } });
      expect((await app.fetch(post("/rex/rpc/toggle-dust", PARTNER))).status).toBe(200);
      expect((await app.fetch(post("/rex/rpc/toggle-dust", ORIGIN))).status).toBe(200);
      expect(
        (await app.fetch(post("/rex/rpc/toggle-dust", "https://partner.example:8443"))).status,
      ).toBe(403);
      expect(await ledger.list()).toHaveLength(2);
    });

    it("leaves safe methods and paths outside /rex unchecked", async () => {
      const app = serverWith(ledger);
      app.post("/hooks/payment", (c) => c.text("received"));
      const manifest = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      expect(manifest.status).toBe(200);
      const hook = await app.fetch(
        new Request(`${ORIGIN}/hooks/payment`, { method: "POST", body: "{}" }),
      );
      expect(hook.status).toBe(200);
      expect(await hook.text()).toBe("received");
    });

    it("accepts the app-scheme origins of desktop and mobile webviews listed in security.origins", async () => {
      const app = serverWith(ledger, { security: { origins: [TAURI, CAPACITOR] } });
      expect((await app.fetch(post("/rex/rpc/toggle-dust", TAURI))).status).toBe(200);
      expect((await app.fetch(post("/rex/rpc/toggle-dust", CAPACITOR))).status).toBe(200);
      expect((await app.fetch(post("/rex/rpc/toggle-dust", "ionic://localhost"))).status).toBe(403);
      expect((await app.fetch(post("/rex/rpc/toggle-dust", "tauri://evil.example"))).status).toBe(
        403,
      );
      expect(await ledger.list()).toHaveLength(2);
      expect(() =>
        serverWith(ledger, { security: { origins: ["tauri://localhost/index.html"] } }),
      ).toThrow(/REX115/);
    });

    it("rejects an invalid security config with the config error code", () => {
      expect(() =>
        serverWith(ledger, { security: { origins: ["https://partner.example/path"] } }),
      ).toThrow(/REX115|security\.origins\.0/);
    });
  });

  describe("the default server of the entry rex build generates", () => {
    it("passes the rex.config security and client options to createRexServer", async () => {
      const entry = generateServerEntry({
        config: "/app/rex.config.ts",
        runtime: serverRuntimePaths(),
        manifest: "/app/.rex/manifest.json",
      });
      expect(entry).toContain("import { configServer, configServerOptions, readConfigExport }");
      expect(entry).toContain("const config = readConfigExport(exported);");
      expect(entry).toContain("const server = configServer(config, (app) =>");
      expect(entry).toContain("    ...configServerOptions(config),");

      const config = readConfigExport(
        defineConfig({
          app: {
            name: "demo",
            registry: createRegistry().register(toggleDust, portfolio).freeze(),
          },
          security: { origins: [TAURI] },
          client: { apiOrigin: "https://api.example" },
        }),
      );
      const app = configServer(config, (bundle) =>
        createRexServer({
          registry: bundle.registry,
          ledger,
          actor: resolveActor,
          app: bundle.name,
          ...configServerOptions(config),
        }),
      );
      const posted = await app.fetch(post("/rex/rpc/toggle-dust", TAURI));
      expect(posted.status).toBe(200);
      const policy = posted.headers.get(CSP_HEADER);
      expect(policy).toBe(strictPolicy(cspNonce(policy), "'self' https://api.example"));
      expect((await app.fetch(post("/rex/rpc/toggle-dust", PARTNER))).status).toBe(403);
      expect((await ledger.list()).map((record) => record.actionId)).toEqual(["toggle-dust"]);
    });
  });

  describe("Content-Security-Policy and companion headers", () => {
    it("sends a strict policy with a fresh nonce on every response by default", async () => {
      const app = serverWith(ledger);
      const first = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      const second = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      const firstNonce = cspNonce(first.headers.get(CSP_HEADER));
      const secondNonce = cspNonce(second.headers.get(CSP_HEADER));
      expect(firstNonce).toMatch(/^[0-9a-f]{32}$/);
      expect(secondNonce).not.toBe(firstNonce);
      expect(first.headers.get(CSP_HEADER)).toBe(strictPolicy(firstNonce));
      expect(first.headers.get(CSP_REPORT_ONLY_HEADER)).toBeNull();
      expect(first.headers.get("x-content-type-options")).toBe("nosniff");
      expect(first.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(first.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(first.headers.get("content-type")).toBe("application/json; charset=utf-8");
      const rejected = await app.fetch(post("/rex/rpc/toggle-dust"));
      expect(rejected.headers.get(CSP_HEADER)).toBe(
        strictPolicy(cspNonce(rejected.headers.get(CSP_HEADER))),
      );
      expect(rejected.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("adds the client apiOrigin to connect-src", async () => {
      const app = serverWith(ledger, { client: { apiOrigin: "https://api.example" } });
      const response = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      const policy = response.headers.get(CSP_HEADER);
      expect(policy).toBe(strictPolicy(cspNonce(policy), "'self' https://api.example"));
    });

    it("sends the same policy as report-only in report mode", async () => {
      const app = serverWith(ledger, { security: { csp: "report" } });
      const response = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      const policy = response.headers.get(CSP_REPORT_ONLY_HEADER);
      expect(response.headers.get(CSP_HEADER)).toBeNull();
      expect(policy).toBe(strictPolicy(cspNonce(policy)));
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    });

    it("sends no policy when csp is off but keeps the companion headers", async () => {
      const app = serverWith(ledger, { security: { csp: "off" } });
      const response = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      expect(response.headers.get(CSP_HEADER)).toBeNull();
      expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toBeNull();
      expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    });

    it("applies header overrides from security.headers", async () => {
      const app = serverWith(ledger, {
        security: { headers: { "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" } },
      });
      const response = await app.fetch(new Request(`${ORIGIN}${MANIFEST_PATH}`));
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get(CSP_HEADER)).toBe(
        strictPolicy(cspNonce(response.headers.get(CSP_HEADER))),
      );
    });
  });

  describe("nonce on inline scripts", () => {
    it("matches the policy nonce on every inline script of a streamed SSR response", async () => {
      const app = serverWith(ledger);
      app.get("/", async (c) => {
        const nonce = requestNonce(c.req.raw);
        const stream = await renderToReadableStream(
          documentFor(
            nonce,
            createElement(
              Suspense,
              { fallback: createElement("p", null, "Loading") },
              createElement(Balance, { amount: delayed("42.00", 20) }),
            ),
          ),
          { nonce, bootstrapScriptContent: "window.__rexBoot = true;" },
        );
        return c.body(stream, 200, { "content-type": "text/html; charset=utf-8" });
      });

      const first = await app.fetch(new Request(`${ORIGIN}/`));
      const html = await first.text();
      const nonce = cspNonce(first.headers.get(CSP_HEADER));
      expect(first.headers.get(CSP_HEADER)).toBe(strictPolicy(nonce));
      expect(html).toContain("42.00");
      expect(html).toContain("window.__rexBoot = true;");
      expect(html).toContain("\\u003c/script\\u003e");
      const inline = scriptTags(html).filter((script) => !script.external);
      expect(inline.length).toBeGreaterThanOrEqual(3);
      expect(inline.some((script) => script.tag.includes("application/rex+data"))).toBe(true);
      for (const script of inline) expect(script.nonce, script.tag).toBe(nonce);

      const second = await app.fetch(new Request(`${ORIGIN}/`));
      const secondNonce = cspNonce(second.headers.get(CSP_HEADER));
      expect(secondNonce).not.toBe(nonce);
      for (const script of scriptTags(await second.text())) {
        expect(script.nonce, script.tag).toBe(secondNonce);
      }
    });

    it("does not stamp the nonce onto script markup Rex did not emit", async () => {
      const app = serverWith(ledger);
      app.get("/", async (c) => {
        const nonce = requestNonce(c.req.raw);
        const stream = await renderToReadableStream(
          documentFor(
            nonce,
            createElement("div", {
              dangerouslySetInnerHTML: { __html: "<script>window.injected = true</script>" },
            }),
          ),
          { nonce, bootstrapScriptContent: "window.__rexBoot = true;" },
        );
        return c.body(stream, 200, { "content-type": "text/html; charset=utf-8" });
      });
      const response = await app.fetch(new Request(`${ORIGIN}/`));
      const nonce = cspNonce(response.headers.get(CSP_HEADER));
      const scripts = scriptTags(await response.text());
      const injected = scripts.filter((script) => script.nonce === null);
      expect(injected.map((script) => script.tag)).toEqual(["<script>"]);
      expect(scripts.filter((script) => script.nonce === nonce)).toHaveLength(2);
    });
  });

  describe("dev HTML transform", () => {
    let root: string;
    let vite: ViteDevServer;

    beforeAll(async () => {
      root = mkdtempSync(join(tmpdir(), "rex-nonce-"));
      writeFileSync(join(root, "main.ts"), "export const ready = true;\n");
      vite = await createServer({
        root,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        server: { middlewareMode: true, hmr: false, ws: false },
        plugins: [react(), nonceHook()],
      });
    });

    afterAll(async () => {
      await vite.close();
      rmSync(root, { recursive: true, force: true });
    });

    it("applies a fresh nonce to every inline script and exposes it to the Vite client", async () => {
      const source = [
        "<!doctype html>",
        "<html><head><title>Rex</title>",
        "<script>window.theme = 'dark'</script>",
        "<script type='text/javascript' nonce='stale'>window.early = 1</script>",
        '</head><body><div id="root"></div>',
        '<script type="module" src="/main.ts"></script>',
        "</body></html>",
      ].join("\n");
      const first = await vite.transformIndexHtml("/", source);
      const second = await vite.transformIndexHtml("/", source);
      const meta = new RegExp(`<meta property="${CSP_NONCE_META_PROPERTY}" nonce="([0-9a-f]{32})"`);
      const firstNonce = meta.exec(first)?.[1];
      const secondNonce = meta.exec(second)?.[1];
      expect(firstNonce).toBeDefined();
      expect(secondNonce).toBeDefined();
      expect(secondNonce).not.toBe(firstNonce);
      const scripts = scriptTags(first);
      const inline = scripts.filter((script) => !script.external);
      expect(inline.length).toBeGreaterThanOrEqual(2);
      for (const script of inline) expect(script.nonce, script.tag).toBe(firstNonce);
      expect(first).not.toContain("stale");
      expect(first).toContain(
        `<script type='text/javascript' nonce="${firstNonce ?? ""}">window.early = 1`,
      );
      const external = scripts.filter((script) => script.external);
      expect(external.some((script) => script.tag.includes('src="/main.ts"'))).toBe(true);
      for (const script of external) expect(script.nonce, script.tag).toBeNull();
    });
  });
});
