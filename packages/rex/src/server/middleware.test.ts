import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action, type AnyAction } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { text } from "../schema/index.ts";
import { ACCEPT_CH, ACCEPT_CH_HEADER, installClientHints } from "./adapters/client-hints.ts";
import type { RexServerOptions, RexServerSetup } from "./app.ts";
import { memoryLedger, type Ledger } from "./audit.ts";
import { installLoaderRunner, loaderRunnerFor } from "./loaders.ts";
import { REX_MIDDLEWARE } from "./middleware.ts";
import { installCorsMiddleware } from "./middleware/cors.ts";
import { CSP_HEADER, installSecurityMiddleware } from "./middleware/security.ts";
import {
  ATTR_ACTION_ID,
  ATTR_OUTCOME,
  ATTR_PAGE_ID,
  SPAN_FORM,
  SPAN_RENDER,
  installTelemetry,
  telemetryFor,
} from "./middleware/telemetry.ts";
import { buildActionRouter } from "./router.ts";

const ORIGIN = "http://rex.test";
const PARTNER = "https://partner.example";

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  label: "Echo",
  handler: (input) => ({ echoed: input.text.toUpperCase() }),
});

const home = page("home", { route: "/", actions: [echo], regions: ["main"] });

const source = { entities: [], actions: [echo], pages: [home], policies: [] };
const ada = actor({ id: "ada" });

function setupFor(options: RexServerOptions<AnyAction>): RexServerSetup {
  return {
    options,
    handler: new RPCHandler(buildActionRouter(options.registry, { ledger: options.ledger })),
    manifestBody: stableStringify(buildManifest(options.registry, { app: "middleware" })),
  };
}

function spansNamed(exporter: InMemorySpanExporter, name: string): ReadableSpan[] {
  return exporter.getFinishedSpans().filter((span) => span.name === name);
}

describe("REX_MIDDLEWARE", () => {
  it("lists the installers in the order the server applies them", () => {
    const expected = [
      installSecurityMiddleware,
      installTelemetry,
      installLoaderRunner,
      installCorsMiddleware,
      installClientHints,
    ];
    expect(REX_MIDDLEWARE).toHaveLength(expected.length);
    expected.forEach((install, index) => {
      expect(REX_MIDDLEWARE[index], install.name).toBe(install);
    });
  });
});

describe("installing REX_MIDDLEWARE on a Hono app", () => {
  let exporter: InMemorySpanExporter;
  let ledger: Ledger;
  let app: Hono;
  let reached: string[];

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    ledger = memoryLedger();
    reached = [];
    const tracer = provider.getTracer("rex-middleware-test");
    app = new Hono();
    for (const install of REX_MIDDLEWARE) {
      install(
        app,
        setupFor({
          registry: source,
          ledger,
          actor: () => ada,
          security: { origins: [PARTNER] },
          telemetry: { tracer },
        }),
      );
    }
    app.get("/", (c) => {
      reached.push(`GET / runner=${String(loaderRunnerFor(c.req.raw) !== undefined)}`);
      return c.html("<p>home</p>");
    });
    app.post("/rex/form/:action", (c) => {
      reached.push(`POST ${c.req.path} runner=${String(loaderRunnerFor(c.req.raw) !== undefined)}`);
      return c.text("posted");
    });
    expect(telemetryFor(ledger).tracer).toBe(tracer);
  });

  it("secures, traces, binds the loader runner, applies CORS and client hints on a page request", async () => {
    const response = await app.request(`${ORIGIN}/`, { headers: { origin: PARTNER } });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<p>home</p>");
    expect(reached).toEqual(["GET / runner=true"]);
    expect(response.headers.get(CSP_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBe(PARTNER);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
    const [rendered] = spansNamed(exporter, SPAN_RENDER);
    expect(rendered?.attributes).toEqual({ [ATTR_PAGE_ID]: "home", [ATTR_OUTCOME]: "ok" });
  });

  it("traces a same-origin form post without binding a loader runner or client hints", async () => {
    const response = await app.request(`${ORIGIN}/rex/form/echo`, {
      method: "POST",
      headers: { origin: ORIGIN },
      body: new URLSearchParams({ text: "hi" }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("posted");
    expect(reached).toEqual(["POST /rex/form/echo runner=false"]);
    expect(response.headers.get(ACCEPT_CH_HEADER)).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.get(CSP_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    const [form] = spansNamed(exporter, SPAN_FORM);
    expect(form?.attributes).toEqual({ [ATTR_ACTION_ID]: "echo", [ATTR_OUTCOME]: "ok" });
  });

  it("lets the security check refuse a cross-origin post before telemetry or the route see it", async () => {
    const response = await app.request(`${ORIGIN}/rex/form/echo`, {
      method: "POST",
      body: new URLSearchParams({ text: "hi" }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("FORBIDDEN");
    expect(reached).toEqual([]);
    expect(exporter.getFinishedSpans()).toEqual([]);
    expect(response.headers.get(CSP_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    expect(await ledger.list()).toEqual([]);
  });
});
