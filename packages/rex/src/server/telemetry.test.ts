import { ORPCError, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { beforeEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import type { RexLogger } from "../core/config.ts";
import { page } from "../core/page.ts";
import { always, never } from "../core/policy.ts";
import { text } from "../schema/index.ts";
import { z } from "zod/mini";
import {
  ATTR_ACTION_ID,
  ATTR_ACTOR_ID,
  ATTR_OUTCOME,
  ATTR_PAGE_ID,
  LOG_PREFIX,
  ORIGIN_HEADER,
  SPAN_ACTION,
  SPAN_FORM,
  SPAN_LOADER,
  SPAN_RENDER,
  createConsoleLogger,
  createRexServer,
  createTelemetry,
  memoryLedger,
  telemetryFor,
  traceLoader,
  validateAuditEntry,
  type AuditEntry,
  type Ledger,
  type RegistryRouterClient,
} from "./index.ts";

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  label: "Echo",
  handler: (input) => ({ echoed: input.text.toUpperCase() }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  handler: () => ({}),
});

const explode = action("explode", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "reversible",
  handler: () => {
    throw new Error("boom");
  },
});

const home = page("home", { route: "/", actions: [echo, purge, explode], regions: ["main"] });
const detail = page("detail", {
  route: "/items/:itemId",
  params: z.object({ itemId: text({ min: 1 }) }),
  regions: ["main"],
});
const settings = page("settings", { route: "/items/settings", regions: ["main"] });

const source = {
  entities: [],
  actions: [echo, purge, explode],
  pages: [home, detail, settings],
  policies: [],
};

const ORIGIN = "http://rex.test";
const RPC_URL = `${ORIGIN}/rex/rpc`;

const ada = actor({ id: "ada", roles: ["owner"], permissions: [] });

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer ada" ? ada : anonymousActor;
}

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

function spansNamed(exporter: InMemorySpanExporter, name: string): ReadableSpan[] {
  return exporter.getFinishedSpans().filter((span) => span.name === name);
}

describe("createRexServer telemetry", () => {
  let exporter: InMemorySpanExporter;
  let ledger: Ledger;
  let lines: LogLine[];
  let app: ReturnType<typeof createRexServer>;
  let client: RegistryRouterClient<typeof source>;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    ledger = memoryLedger();
    lines = [];
    app = createRexServer({
      registry: source,
      ledger,
      actor: resolveActor,
      app: "probe",
      telemetry: { tracer: provider.getTracer("rex-test"), logger: recordingLogger(lines) },
    });
    client = createORPCClient(
      new RPCLink({
        url: RPC_URL,
        headers: { authorization: "Bearer ada", [ORIGIN_HEADER]: ORIGIN },
        fetch: async (request) => app.fetch(request),
      }),
    );
  });

  it("wraps an action invocation in a rex.action span and stamps its ids on the audit record", async () => {
    await expect(client.echo({ text: "hi" })).resolves.toEqual({ echoed: "HI" });
    const [span] = spansNamed(exporter, SPAN_ACTION);
    expect(span).toBeDefined();
    const finished = span as ReadableSpan;
    expect(finished.attributes).toEqual({
      [ATTR_ACTION_ID]: "echo",
      [ATTR_ACTOR_ID]: "ada",
      [ATTR_OUTCOME]: "ok",
    });
    expect(finished.status.code).toBe(1);
    expect(finished.ended).toBe(true);
    const [record] = await ledger.list();
    expect(record?.outcome).toBe("ok");
    expect(record?.traceId).toBe(finished.spanContext().traceId);
    expect(record?.spanId).toBe(finished.spanContext().spanId);
    expect(record?.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(record?.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(lines).toEqual([]);
  });

  it("records a refused action with its error code on the span and the audit record", async () => {
    const error = await client.purge({}).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(ORPCError);
    const [span] = spansNamed(exporter, SPAN_ACTION);
    expect(span?.attributes[ATTR_OUTCOME]).toBe("FORBIDDEN");
    expect(span?.attributes[ATTR_ACTION_ID]).toBe("purge");
    expect(span?.status.code).toBe(2);
    expect(span?.status.message).toBe("FORBIDDEN");
    expect(span?.events.map((event) => event.name)).toEqual(["exception"]);
    const [record] = await ledger.list();
    expect(record?.outcome).toBe("FORBIDDEN");
    expect(record?.traceId).toBe(span?.spanContext().traceId);
    expect(lines).toEqual([]);
  });

  it("logs a server fault through the configured logger", async () => {
    await expect(client.explode({})).rejects.toBeInstanceOf(ORPCError);
    const [span] = spansNamed(exporter, SPAN_ACTION);
    expect(span?.attributes[ATTR_OUTCOME]).toBe("INTERNAL_SERVER_ERROR");
    expect(lines).toHaveLength(1);
    expect(lines[0]?.level).toBe("error");
    expect(lines[0]?.message).toBe("rex.action failed");
    expect(lines[0]?.attributes).toMatchObject({
      [ATTR_ACTION_ID]: "explode",
      [ATTR_ACTOR_ID]: "ada",
      [ATTR_OUTCOME]: "INTERNAL_SERVER_ERROR",
    });
  });

  it("wraps a form post in a rex.form span named after the action", async () => {
    const response = await app.request(`${ORIGIN}/rex/form/echo`, {
      method: "POST",
      headers: { [ORIGIN_HEADER]: ORIGIN },
      body: new URLSearchParams({ text: "hi" }),
    });
    const [span] = spansNamed(exporter, SPAN_FORM);
    expect(span?.attributes[ATTR_ACTION_ID]).toBe("echo");
    expect(span?.attributes[ATTR_OUTCOME]).toBe(
      response.status < 400 ? "ok" : `HTTP_${response.status}`,
    );
  });

  it("wraps a page request in a rex.render span resolved from the page routes", async () => {
    const responses = await Promise.all(
      ["/", "/items/42", "/items/settings"].map((path) => app.request(path)),
    );
    const spans = spansNamed(exporter, SPAN_RENDER);
    expect(spans.map((span) => span.attributes[ATTR_PAGE_ID]).sort()).toEqual([
      "detail",
      "home",
      "settings",
    ]);
    for (const span of spans) {
      const index = ["home", "detail", "settings"].indexOf(String(span.attributes[ATTR_PAGE_ID]));
      const status = (responses[index] as Response).status;
      expect(span.attributes[ATTR_OUTCOME]).toBe(status < 400 ? "ok" : `HTTP_${status}`);
    }
    await app.request("/missing/page/route");
    await app.request("/rex/health");
    expect(spansNamed(exporter, SPAN_RENDER)).toHaveLength(3);
  });

  it("does not trace manifest and health requests", async () => {
    expect((await app.request("/rex/health")).status).toBe(200);
    expect((await app.request("/rex/manifest")).status).toBe(200);
    expect(exporter.getFinishedSpans()).toEqual([]);
  });

  it("binds the server telemetry so loaders run in rex.loader spans", async () => {
    const telemetry = telemetryFor(ledger);
    const value = await traceLoader(
      telemetry,
      { pageId: "home", actionId: "echo", actorId: "ada" },
      async () => echo.handler({ text: "loaded" }, { actor: ada }),
    );
    expect(value).toEqual({ echoed: "LOADED" });
    const [span] = spansNamed(exporter, SPAN_LOADER);
    expect(span?.attributes).toEqual({
      [ATTR_PAGE_ID]: "home",
      [ATTR_ACTION_ID]: "echo",
      [ATTR_ACTOR_ID]: "ada",
      [ATTR_OUTCOME]: "ok",
    });
  });
});

describe("telemetry without a tracer", () => {
  it("audits without trace ids and logs through the console logger by default", async () => {
    const ledger = memoryLedger();
    const app = createRexServer({ registry: source, ledger, actor: resolveActor });
    const client: RegistryRouterClient<typeof source> = createORPCClient(
      new RPCLink({
        url: RPC_URL,
        headers: { [ORIGIN_HEADER]: ORIGIN },
        fetch: async (request) => app.fetch(request),
      }),
    );
    await expect(client.echo({ text: "hi" })).resolves.toEqual({ echoed: "HI" });
    const [record] = await ledger.list();
    expect(record?.actor).toBe(anonymousActor.id);
    expect(record).not.toHaveProperty("traceId");
    expect(record).not.toHaveProperty("spanId");
    expect(telemetryFor(ledger).tracer).toBeNull();
  });

  it("prefixes console lines with rex:", () => {
    const written: unknown[][] = [];
    const target = {
      debug: (...data: unknown[]) => written.push(["debug", ...data]),
      info: (...data: unknown[]) => written.push(["info", ...data]),
      warn: (...data: unknown[]) => written.push(["warn", ...data]),
      error: (...data: unknown[]) => written.push(["error", ...data]),
    };
    const logger = createConsoleLogger(target);
    logger.debug("started");
    logger.info("ready", { port: 3000 });
    logger.warn("slow");
    logger.error("failed", { code: "BOOM" });
    expect(LOG_PREFIX).toBe("rex:");
    expect(written).toEqual([
      ["debug", "rex: started"],
      ["info", "rex: ready", { port: 3000 }],
      ["warn", "rex: slow"],
      ["error", "rex: failed", { code: "BOOM" }],
    ]);
  });

  it("rejects a tracer without startSpan", () => {
    expect(() =>
      createTelemetry({ tracer: {} as unknown as { startSpan(name: string): unknown } }),
    ).toThrow("telemetry: tracer must be an OpenTelemetry tracer with startSpan");
  });
});

describe("audit trace ids", () => {
  const entry: AuditEntry = {
    actor: "ada",
    actionId: "echo",
    inputDigest: "a".repeat(64),
    outcome: "ok",
    effect: "read",
    durationMs: 1,
    at: "2026-10-04T00:00:00.000Z",
  };

  it("keeps a valid traceId and spanId pair", () => {
    expect(validateAuditEntry({ ...entry, traceId: "b".repeat(32), spanId: "c".repeat(16) })).toEqual(
      { ...entry, traceId: "b".repeat(32), spanId: "c".repeat(16) },
    );
    expect(validateAuditEntry(entry)).toEqual(entry);
  });

  it("rejects malformed or unpaired trace ids", () => {
    expect(() => validateAuditEntry({ ...entry, traceId: "b".repeat(32) })).toThrow(
      "audit: traceId and spanId must be given together",
    );
    expect(() =>
      validateAuditEntry({ ...entry, traceId: "B".repeat(32), spanId: "c".repeat(16) }),
    ).toThrow("audit: traceId must be 32 lowercase hex characters");
    expect(() =>
      validateAuditEntry({ ...entry, traceId: "b".repeat(32), spanId: "c".repeat(15) }),
    ).toThrow("audit: spanId must be 16 lowercase hex characters");
  });
});
