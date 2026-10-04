import { trace } from "@opentelemetry/api";
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
import { action, type AnyAction } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import type { RexLogger } from "../../core/config.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { text } from "../../schema/index.ts";
import type { RexServerOptions, RexServerSetup } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { buildActionRouter } from "../router.ts";
import {
  ATTR_ACTION_ID,
  ATTR_ACTOR_ID,
  ATTR_OUTCOME,
  ATTR_PAGE_ID,
  LOG_PREFIX,
  OUTCOME_ERROR,
  OUTCOME_OK,
  REX_FORM_PREFIX,
  REX_PATH_PREFIX,
  SPAN_ACTION,
  SPAN_FORM,
  SPAN_LOADER,
  SPAN_RENDER,
  bindTelemetry,
  consoleLogger,
  createConsoleLogger,
  createTelemetry,
  installTelemetry,
  isTelemetryTracer,
  matchPagePath,
  telemetryFor,
  traceLoader,
} from "./telemetry.ts";

const ORIGIN = "http://rex.test";
const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  handler: (input) => ({ echoed: input.text.toUpperCase() }),
});

const home = page("home", { route: "/", actions: [echo], regions: ["main"] });
const detail = page("detail", {
  route: "/items/:itemId",
  params: z.object({ itemId: text({ min: 1 }) }),
  regions: ["main"],
});
const settings = page("settings", { route: "/items/settings", regions: ["main"] });

const source = { entities: [], actions: [echo], pages: [home, detail, settings], policies: [] };
const ada = actor({ id: "ada" });

interface LogLine {
  readonly level: string;
  readonly message: string;
  readonly attributes: Readonly<Record<string, unknown>> | undefined;
}

function recordingLogger(lines: LogLine[]): RexLogger {
  const at =
    (level: string) =>
    (message: string, attributes?: Readonly<Record<string, unknown>>): void => {
      lines.push({ level, message, attributes });
    };
  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

function setupFor(options: RexServerOptions<AnyAction>): RexServerSetup {
  return {
    options,
    handler: new RPCHandler(buildActionRouter(options.registry, { ledger: options.ledger })),
    manifestBody: stableStringify(buildManifest(options.registry, { app: "telemetry" })),
  };
}

describe("constants", () => {
  it("names the spans, attributes and prefixes the server traces with", () => {
    expect([SPAN_ACTION, SPAN_FORM, SPAN_LOADER, SPAN_RENDER]).toEqual([
      "rex.action",
      "rex.form",
      "rex.loader",
      "rex.render",
    ]);
    expect([ATTR_ACTION_ID, ATTR_ACTOR_ID, ATTR_PAGE_ID, ATTR_OUTCOME]).toEqual([
      "rex.action.id",
      "rex.actor.id",
      "rex.page.id",
      "rex.outcome",
    ]);
    expect(REX_PATH_PREFIX).toBe("/rex/");
    expect(REX_FORM_PREFIX).toBe("/rex/form");
    expect(OUTCOME_OK).toBe("ok");
    expect(OUTCOME_ERROR).toBe("ERROR");
  });
});

describe("createConsoleLogger", () => {
  it("prefixes every line with rex: and forwards attributes only when given", () => {
    const written: unknown[][] = [];
    const logger = createConsoleLogger({
      debug: (...data) => written.push(["debug", ...data]),
      info: (...data) => written.push(["info", ...data]),
      warn: (...data) => written.push(["warn", ...data]),
      error: (...data) => written.push(["error", ...data]),
    });
    logger.debug("started");
    logger.info("ready", { port: 3000 });
    logger.warn("slow", {});
    logger.error("failed", { code: "BOOM" });
    expect(LOG_PREFIX).toBe("rex:");
    expect(written).toEqual([
      ["debug", "rex: started"],
      ["info", "rex: ready", { port: 3000 }],
      ["warn", "rex: slow", {}],
      ["error", "rex: failed", { code: "BOOM" }],
    ]);
    expect(Object.isFrozen(logger)).toBe(true);
  });

  it("is the logger of a telemetry created without configuration", () => {
    const telemetry = createTelemetry();
    expect(telemetry.logger).toBe(consoleLogger);
    expect(telemetry.tracer).toBeNull();
    expect(Object.isFrozen(telemetry)).toBe(true);
  });
});

describe("isTelemetryTracer", () => {
  it("accepts objects with startSpan and createTelemetry rejects the rest with REX400", () => {
    const provider = new BasicTracerProvider();
    expect(isTelemetryTracer(provider.getTracer("rex"))).toBe(true);
    expect(isTelemetryTracer(trace.getTracer("rex"))).toBe(true);
    expect(isTelemetryTracer({})).toBe(false);
    expect(isTelemetryTracer(null)).toBe(false);
    expect(isTelemetryTracer("tracer")).toBe(false);
    expect(isTelemetryTracer({ startSpan: "later" })).toBe(false);
    expect(() => createTelemetry({ tracer: { startSpan: "later" } as never })).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX400",
        message: "REX400 telemetry: tracer must be an OpenTelemetry tracer with startSpan",
      }),
    );
  });
});

describe("span", () => {
  let exporter: InMemorySpanExporter;
  let lines: LogLine[];
  let traced: ReturnType<typeof createTelemetry>;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    lines = [];
    traced = createTelemetry({
      tracer: provider.getTracer("rex-telemetry-test"),
      logger: recordingLogger(lines),
    });
  });

  it("records the attributes, the ids and an ok status on a real tracer span", async () => {
    let ids: { readonly traceId: string | null; readonly spanId: string | null } | null = null;
    const value = await traced.span(SPAN_ACTION, { [ATTR_ACTION_ID]: "echo" }, (span) => {
      expect(span.name).toBe(SPAN_ACTION);
      ids = { traceId: span.traceId, spanId: span.spanId };
      span.set({ [ATTR_ACTOR_ID]: "ada", "rex.rows": 3, "rex.cached": false });
      return 42;
    });
    expect(value).toBe(42);
    const [finished] = exporter.getFinishedSpans();
    expect(finished).toBeDefined();
    const span = finished as ReadableSpan;
    expect(span.name).toBe(SPAN_ACTION);
    expect(span.ended).toBe(true);
    expect(span.attributes).toEqual({
      [ATTR_ACTION_ID]: "echo",
      [ATTR_ACTOR_ID]: "ada",
      "rex.rows": 3,
      "rex.cached": false,
      [ATTR_OUTCOME]: OUTCOME_OK,
    });
    expect(span.status).toEqual({ code: SPAN_STATUS_OK });
    expect(span.events).toEqual([]);
    expect(ids).toEqual({
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
    });
    expect(span.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(lines).toEqual([]);
  });

  it("marks a thrown error as ERROR, records the exception and logs the failure", async () => {
    await expect(
      traced.span(SPAN_RENDER, { [ATTR_PAGE_ID]: "home" }, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes).toEqual({ [ATTR_PAGE_ID]: "home", [ATTR_OUTCOME]: OUTCOME_ERROR });
    expect(span?.status).toEqual({ code: SPAN_STATUS_ERROR, message: OUTCOME_ERROR });
    expect(span?.events.map((event) => event.name)).toEqual(["exception"]);
    expect(lines).toEqual([
      {
        level: "error",
        message: `${SPAN_RENDER} failed`,
        attributes: { [ATTR_PAGE_ID]: "home", [ATTR_OUTCOME]: OUTCOME_ERROR, error: "boom" },
      },
    ]);
  });

  it("keeps an explicit outcome as the span status and logs only server faults", async () => {
    await traced.span(SPAN_ACTION, { [ATTR_ACTION_ID]: "purge" }, (span) => {
      span.outcome("FORBIDDEN");
    });
    await traced.span(SPAN_FORM, { [ATTR_ACTION_ID]: "echo" }, (span) => {
      span.outcome("HTTP_404");
    });
    expect(lines).toEqual([]);
    await traced.span(SPAN_FORM, { [ATTR_ACTION_ID]: "echo" }, (span) => {
      span.outcome("HTTP_503");
    });
    await expect(
      traced.span(SPAN_ACTION, { [ATTR_ACTION_ID]: "explode" }, (span) => {
        span.outcome("INTERNAL_SERVER_ERROR");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const spans = exporter.getFinishedSpans();
    expect(spans.map((span) => [span.attributes[ATTR_OUTCOME], span.status])).toEqual([
      ["FORBIDDEN", { code: SPAN_STATUS_ERROR, message: "FORBIDDEN" }],
      ["HTTP_404", { code: SPAN_STATUS_ERROR, message: "HTTP_404" }],
      ["HTTP_503", { code: SPAN_STATUS_ERROR, message: "HTTP_503" }],
      ["INTERNAL_SERVER_ERROR", { code: SPAN_STATUS_ERROR, message: "INTERNAL_SERVER_ERROR" }],
    ]);
    expect(spans.map((span) => span.events.length)).toEqual([0, 0, 0, 1]);
    expect(lines).toEqual([
      {
        level: "error",
        message: `${SPAN_FORM} failed`,
        attributes: { [ATTR_ACTION_ID]: "echo", [ATTR_OUTCOME]: "HTTP_503" },
      },
      {
        level: "error",
        message: `${SPAN_ACTION} failed`,
        attributes: {
          [ATTR_ACTION_ID]: "explode",
          [ATTR_OUTCOME]: "INTERNAL_SERVER_ERROR",
          error: "boom",
        },
      },
    ]);
  });

  it("runs without a tracer, with empty ids and the same logging", async () => {
    const untraced = createTelemetry({ logger: recordingLogger(lines) });
    expect(untraced.tracer).toBeNull();
    const ids = await untraced.span(SPAN_LOADER, { [ATTR_PAGE_ID]: "home" }, (span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
    }));
    expect(ids).toEqual({ traceId: null, spanId: null });
    await expect(
      untraced.span(SPAN_LOADER, { [ATTR_PAGE_ID]: "home" }, () =>
        Promise.reject(new Error("down")),
      ),
    ).rejects.toThrow("down");
    expect(lines).toEqual([
      {
        level: "error",
        message: `${SPAN_LOADER} failed`,
        attributes: { [ATTR_PAGE_ID]: "home", [ATTR_OUTCOME]: OUTCOME_ERROR, error: "down" },
      },
    ]);
  });

  it("leaves the ids empty when the tracer yields an invalid span context", async () => {
    const noop = createTelemetry({ tracer: trace.getTracer("rex-noop") });
    expect(noop.tracer).not.toBeNull();
    const ids = await noop.span(SPAN_LOADER, {}, (span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
    }));
    expect(ids).toEqual({ traceId: null, spanId: null });
  });
});

describe("bindTelemetry", () => {
  it("shares one default telemetry for unbound ledgers and returns the bound one afterwards", () => {
    const ledger = memoryLedger();
    const other = memoryLedger();
    const fallback = telemetryFor(ledger);
    expect(fallback.tracer).toBeNull();
    expect(fallback.logger).toBe(consoleLogger);
    expect(telemetryFor(other)).toBe(fallback);
    const telemetry = createTelemetry({ tracer: new BasicTracerProvider().getTracer("rex") });
    bindTelemetry(ledger, telemetry);
    expect(telemetryFor(ledger)).toBe(telemetry);
    expect(telemetryFor(other)).toBe(fallback);
  });
});

describe("matchPagePath", () => {
  it("prefers routes with more static segments and requires non-empty params", () => {
    const matchers = [
      { page: settings, statics: ["items", "settings"], weight: 2 },
      { page: detail, statics: ["items", null], weight: 1 },
      { page: home, statics: [], weight: 0 },
    ];
    expect(matchPagePath(matchers, "/")).toBe(home);
    expect(matchPagePath(matchers, "/items/42")).toBe(detail);
    expect(matchPagePath(matchers, "/items/settings")).toBe(settings);
    expect(matchPagePath(matchers, "/items/")).toBeNull();
    expect(matchPagePath(matchers, "/items")).toBeNull();
    expect(matchPagePath(matchers, "/items/42/edit")).toBeNull();
    expect(matchPagePath([], "/")).toBeNull();
  });
});

describe("installTelemetry", () => {
  let exporter: InMemorySpanExporter;
  let lines: LogLine[];
  let app: Hono;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    lines = [];
    const ledger = memoryLedger();
    const tracer = provider.getTracer("rex-telemetry-test");
    app = new Hono();
    installTelemetry(
      app,
      setupFor({
        registry: source,
        ledger,
        actor: () => ada,
        telemetry: { tracer, logger: recordingLogger(lines) },
      }),
    );
    expect(telemetryFor(ledger).tracer).toBe(tracer);
  });

  it("traces form posts and page renders, hands the span to handlers and skips /rex reads", async () => {
    app.post("/rex/form/:action", (c) => c.text("accepted", 201));
    app.get("/items/settings", (c) => {
      c.get("rexSpan").outcome("CUSTOM");
      return c.text("nope", 500);
    });
    app.get("/items/:itemId", (c) => {
      c.get("rexSpan").set({ "rex.item": c.req.param("itemId") });
      return c.text("item");
    });
    app.get("*", (c) => c.text("page"));
    await app.request(`${ORIGIN}/rex/form/send%20now`, { method: "POST" });
    await app.request(`${ORIGIN}/items/42`);
    await app.request(`${ORIGIN}/items/settings`);
    await app.request(`${ORIGIN}/`);
    await app.request(`${ORIGIN}/rex/health`);
    await app.request(`${ORIGIN}/rex/manifest`);
    await app.request(`${ORIGIN}/items/42`, { method: "POST" });
    await app.request(`${ORIGIN}/nowhere/at/all`);
    expect(exporter.getFinishedSpans().map((span) => [span.name, span.attributes])).toEqual([
      [SPAN_FORM, { [ATTR_ACTION_ID]: "send now", [ATTR_OUTCOME]: OUTCOME_OK }],
      [SPAN_RENDER, { [ATTR_PAGE_ID]: "detail", "rex.item": "42", [ATTR_OUTCOME]: OUTCOME_OK }],
      [SPAN_RENDER, { [ATTR_PAGE_ID]: "settings", [ATTR_OUTCOME]: "CUSTOM" }],
      [SPAN_RENDER, { [ATTR_PAGE_ID]: "home", [ATTR_OUTCOME]: OUTCOME_OK }],
    ]);
    expect(lines).toEqual([]);
  });

  it("derives the outcome from the response status when the handler sets none", async () => {
    app.post("/rex/form/:action", (c) => c.text("down", 503));
    app.get("*", (c) => c.text("missing", 404));
    const form = await app.request(`${ORIGIN}/rex/form/echo`, { method: "POST" });
    expect(form.status).toBe(503);
    const render = await app.request(`${ORIGIN}/items/42`, { method: "HEAD" });
    expect(render.status).toBe(404);
    expect(
      exporter.getFinishedSpans().map((span) => [span.name, span.attributes, span.status]),
    ).toEqual([
      [
        SPAN_FORM,
        { [ATTR_ACTION_ID]: "echo", [ATTR_OUTCOME]: "HTTP_503" },
        { code: SPAN_STATUS_ERROR, message: "HTTP_503" },
      ],
      [
        SPAN_RENDER,
        { [ATTR_PAGE_ID]: "detail", [ATTR_OUTCOME]: "HTTP_404" },
        { code: SPAN_STATUS_ERROR, message: "HTTP_404" },
      ],
    ]);
    expect(lines).toEqual([
      {
        level: "error",
        message: `${SPAN_FORM} failed`,
        attributes: { [ATTR_ACTION_ID]: "echo", [ATTR_OUTCOME]: "HTTP_503" },
      },
    ]);
  });
});

describe("traceLoader", () => {
  it("opens a rex.loader span with the page, action and actor and returns the loader value", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const telemetry = createTelemetry({ tracer: provider.getTracer("rex-loader") });
    const value = await traceLoader(
      telemetry,
      { pageId: "home", actionId: "echo", actorId: "ada" },
      (span) => {
        expect(span.name).toBe(SPAN_LOADER);
        return echo.handler({ text: "loaded" }, { actor: ada });
      },
    );
    expect(value).toEqual({ echoed: "LOADED" });
    await expect(
      traceLoader(telemetry, { pageId: "home", actionId: "echo", actorId: "ada" }, (span) => {
        span.outcome("FORBIDDEN");
        return Promise.reject(new Error("denied"));
      }),
    ).rejects.toThrow("denied");
    expect(exporter.getFinishedSpans().map((span) => [span.name, span.attributes])).toEqual([
      [
        SPAN_LOADER,
        {
          [ATTR_PAGE_ID]: "home",
          [ATTR_ACTION_ID]: "echo",
          [ATTR_ACTOR_ID]: "ada",
          [ATTR_OUTCOME]: OUTCOME_OK,
        },
      ],
      [
        SPAN_LOADER,
        {
          [ATTR_PAGE_ID]: "home",
          [ATTR_ACTION_ID]: "echo",
          [ATTR_ACTOR_ID]: "ada",
          [ATTR_OUTCOME]: "FORBIDDEN",
        },
      ],
    ]);
  });
});
