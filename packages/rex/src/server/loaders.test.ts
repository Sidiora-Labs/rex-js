import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { QueryClient } from "@tanstack/react-query";
import { Hono } from "hono";
import { createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import type { RexEntryBundle } from "../client/entry.tsx";
import { RexLoaderError, loaderQueryKey } from "../client/loaders.ts";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action, type AnyAction } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import type { RexLogger } from "../core/config.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always, never } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../schema/index.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { createRexServer, type RexServerOptions, type RexServerSetup } from "./app.ts";
import { memoryLedger, type Ledger } from "./audit.ts";
import { DEFAULT_DENSITY, createRexContext, type RexContext } from "./context.ts";
import {
  bindLoaderRunner,
  createActionLoaderRunner,
  createLoaderRunner,
  installLoaderRunner,
  loaderRunnerFor,
  runPageLoaders,
  withLoaderRunner,
  type LoaderRunner,
} from "./loaders.ts";
import {
  ATTR_ACTION_ID,
  ATTR_ACTOR_ID,
  ATTR_OUTCOME,
  ATTR_PAGE_ID,
  SPAN_ACTION,
  SPAN_LOADER,
  SPAN_RENDER,
  bindTelemetry,
  createTelemetry,
  telemetryFor,
} from "./middleware/telemetry.ts";
import { buildActionRouter } from "./router.ts";
import { RENDER_PAGE_HEADER } from "./routes/render.ts";
import { createRexRenderer, registerPageRenderer } from "./ssr.ts";

const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

const listHoldings = action("list-holdings", {
  input: z.object({}),
  output: z.object({ symbols: z.array(text()) }),
  policy: always(),
  effect: "read",
  label: "List holdings",
  handler: () => ({ symbols: ["BTC", "ETH"] }),
});

const readVault = action("read-vault", {
  input: z.object({}),
  output: z.object({ secret: text() }),
  policy: never(),
  effect: "read",
  label: "Read vault",
  handler: () => ({ secret: "hidden" }),
});

const portfolio = page("portfolio", {
  route: "/",
  chrome: { title: "Portfolio" },
  load: { holdings: listHoldings },
});

const vault = page("vault", {
  route: "/vault",
  chrome: { title: "Vault" },
  load: { secrets: readVault },
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  const say = (sentence: string) => () => createElement("p", null, sentence);
  return {
    Loading: say(`${label} is loading`),
    Empty: say(`${label} is empty`),
    Stale: say(`${label} may be stale`),
    Partial: say(`${label} is partial`),
    Offline: say(`${label} is offline`),
    PermissionDenied: say(`You cannot open ${label}`),
    RecoverableError: say(`${label} failed`),
    TerminalError: say(`${label} is unavailable`),
  };
}

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => Promise.resolve(loaded),
  });
}

const registry = createRegistry().register(listHoldings, readVault, portfolio, vault).freeze();
const bundle: RexEntryBundle = {
  registry,
  manifest: buildManifest(registry, { app: "loader-spans" }),
  pages: [
    lazySet(portfolio, {
      view: view(() => createElement("p", null, "Portfolio body")),
      states: statesFor("the portfolio"),
    }),
    lazySet(vault, {
      view: view(() => createElement("p", null, "Vault body")),
      states: statesFor("the vault"),
    }),
  ],
};
registerPageRenderer(registry, createRexRenderer({ bundle }));

const ada = actor({ id: "ada", roles: ["owner"], permissions: [] });

interface LogLine {
  readonly level: string;
  readonly message: string;
}

function recordingLogger(lines: LogLine[]): RexLogger {
  const at = (level: string) => (message: string) => {
    lines.push({ level, message });
  };
  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

function spansNamed(exporter: InMemorySpanExporter, name: string): ReadableSpan[] {
  return exporter.getFinishedSpans().filter((span) => span.name === name);
}

describe("runPageLoaders telemetry", () => {
  let exporter: InMemorySpanExporter;
  let ledger: Ledger;
  let lines: LogLine[];
  let app: ReturnType<typeof createRexServer>;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    ledger = memoryLedger();
    lines = [];
    app = createRexServer({
      registry,
      ledger,
      actor: () => ada,
      app: "loader-spans",
      telemetry: { tracer: provider.getTracer("rex-loaders-test"), logger: recordingLogger(lines) },
    });
  });

  it("wraps each SSR loader run in a rex.loader span carrying the page, the loader action and the actor", async () => {
    const request = new Request("http://rex.test/", { headers: { accept: "text/html" } });
    const response = await app.fetch(request);
    expect(response.status).toBe(200);
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("portfolio");
    expect(await response.text()).toContain("Portfolio body");

    expect(loaderRunnerFor(request)?.telemetry).toBe(telemetryFor(ledger));
    const loaders = spansNamed(exporter, SPAN_LOADER);
    expect(loaders).toHaveLength(1);
    const span = loaders[0] as ReadableSpan;
    expect(span.attributes).toEqual({
      [ATTR_PAGE_ID]: "portfolio",
      [ATTR_ACTION_ID]: "list-holdings",
      [ATTR_ACTOR_ID]: "ada",
      [ATTR_OUTCOME]: "ok",
    });
    expect(span.status.code).toBe(SPAN_STATUS_OK);

    const [invoked] = spansNamed(exporter, SPAN_ACTION);
    expect(invoked?.attributes[ATTR_ACTION_ID]).toBe("list-holdings");
    const [rendered] = spansNamed(exporter, SPAN_RENDER);
    expect(rendered?.attributes[ATTR_PAGE_ID]).toBe("portfolio");
    expect(lines.filter((line) => line.level === "error")).toEqual([]);
  });

  it("records a refused loader with its error code as the span outcome", async () => {
    await (
      await app.fetch(new Request("http://rex.test/vault", { headers: { accept: "text/html" } }))
    ).text();
    const loaders = spansNamed(exporter, SPAN_LOADER);
    expect(loaders).toHaveLength(1);
    const span = loaders[0] as ReadableSpan;
    expect(span.attributes).toEqual({
      [ATTR_PAGE_ID]: "vault",
      [ATTR_ACTION_ID]: "read-vault",
      [ATTR_ACTOR_ID]: "ada",
      [ATTR_OUTCOME]: "FORBIDDEN",
    });
    expect(span.status).toEqual({ code: SPAN_STATUS_ERROR, message: "FORBIDDEN" });
    expect(span.events.map((event) => event.name)).toEqual(["exception"]);
    expect(lines.map((line) => line.message)).not.toContain(`${SPAN_LOADER} failed`);
  });
});

const readAccount = action("read-account", {
  input: z.object({ id: text({ min: 1 }) }),
  output: z.object({ id: text(), by: text() }),
  policy: always(),
  effect: "read",
  label: "Read account",
  handler: (input, ctx) => ({ id: input.id, by: ctx.actor.id }),
});

const stranger = action("stranger", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "read",
  label: "Stranger",
  handler: () => ({}),
});

const account = page("account", {
  route: "/accounts/:accountId",
  params: z.object({ accountId: text({ min: 1 }) }),
  chrome: { title: "Account" },
  load: {
    detail: {
      action: readAccount,
      input: (params: Readonly<Record<string, unknown>>) => ({ id: String(params.accountId) }),
    },
    mirror: {
      action: readAccount,
      input: (params: Readonly<Record<string, unknown>>) => ({
        id: `${String(params.accountId)}-mirror`,
      }),
    },
  },
});

const plain = page("plain", { route: "/plain", regions: ["main"] });

const source = {
  entities: [],
  actions: [listHoldings, readVault, readAccount],
  pages: [portfolio, vault, account, plain],
  policies: [],
};

const context: RexContext = { actor: ada, density: DEFAULT_DENSITY };

function setupFor(options: RexServerOptions<AnyAction>): RexServerSetup {
  return {
    options,
    handler: new RPCHandler(buildActionRouter(options.registry, { ledger: options.ledger })),
    manifestBody: stableStringify(buildManifest(options.registry, { app: "loader-runner" })),
  };
}

async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    return error as ORPCError<string, unknown>;
  }
  throw new Error("expected the call to reject");
}

describe("createActionLoaderRunner", () => {
  let ledger: Ledger;
  let runner: LoaderRunner;

  beforeEach(() => {
    ledger = memoryLedger();
    runner = createActionLoaderRunner(source, { ledger });
  });

  it("calls a read action of its source through the action router with the given context", async () => {
    expect(Object.isFrozen(runner)).toBe(true);
    await expect(runner.run(listHoldings, {}, context)).resolves.toEqual({
      symbols: ["BTC", "ETH"],
    });
    await expect(runner.run(readAccount, { id: "acc-1" }, context)).resolves.toEqual({
      id: "acc-1",
      by: "ada",
    });
    expect(
      (await ledger.list()).map((record) => [
        record.actor,
        record.actionId,
        record.outcome,
        record.effect,
      ]),
    ).toEqual([
      ["ada", "list-holdings", "ok", "read"],
      ["ada", "read-account", "ok", "read"],
    ]);
  });

  it("rejects a refused action with the router's FORBIDDEN error", async () => {
    const refused = await rejection(runner.run(readVault, {}, context));
    expect(refused.code).toBe("FORBIDDEN");
    expect(refused.status).toBe(403);
    expect(refused.message).toMatch(/^action "read-vault" is forbidden: /);
    expect(
      (await ledger.list()).map((record) => [
        record.actor,
        record.actionId,
        record.outcome,
        record.effect,
      ]),
    ).toEqual([["ada", "read-vault", "FORBIDDEN", "read"]]);
  });

  it("rejects an action outside its source with NOT_FOUND before any audit", async () => {
    const error = await rejection(runner.run(stranger, {}, context));
    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe('unknown action "stranger"');
    expect(await ledger.list()).toEqual([]);
  });

  it("reads the telemetry bound to its ledger at call time", () => {
    expect(runner.telemetry).toBe(telemetryFor(ledger));
    const traced = createTelemetry({
      tracer: new BasicTracerProvider().getTracer("rex-loader-runner"),
    });
    bindTelemetry(ledger, traced);
    expect(runner.telemetry).toBe(traced);
    expect(createActionLoaderRunner(source, { ledger: memoryLedger() }).telemetry).not.toBe(traced);
  });
});

describe("createLoaderRunner", () => {
  it("builds the runner from the setup's registry and ledger", async () => {
    const ledger = memoryLedger();
    const runner = createLoaderRunner(setupFor({ registry: source, ledger, actor: () => ada }));
    await expect(runner.run(listHoldings, {}, context)).resolves.toEqual({
      symbols: ["BTC", "ETH"],
    });
    expect((await ledger.list()).map((record) => record.actionId)).toEqual(["list-holdings"]);
    expect(runner.telemetry).toBe(telemetryFor(ledger));
  });

  it("passes confirmTtlMs on to the action router", () => {
    const ledger = memoryLedger();
    expect(() =>
      createLoaderRunner(setupFor({ registry: source, ledger, actor: () => ada, confirmTtlMs: 0 })),
    ).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX400",
        message: "REX400 buildActionRouter: confirmTtlMs must be a positive integer",
      }),
    );
    expect(
      createLoaderRunner(setupFor({ registry: source, ledger, actor: () => ada, confirmTtlMs: 1 }))
        .telemetry,
    ).toBe(telemetryFor(ledger));
  });
});

describe("bindLoaderRunner and loaderRunnerFor", () => {
  it("binds a runner to one request object and replaces it on rebind", () => {
    const ledger = memoryLedger();
    const first = createActionLoaderRunner(source, { ledger });
    const second = createActionLoaderRunner(source, { ledger });
    expect(first).not.toBe(second);
    const request = new Request("http://rex.test/");
    const twin = new Request("http://rex.test/");
    expect(loaderRunnerFor(request)).toBeUndefined();
    bindLoaderRunner(request, first);
    expect(loaderRunnerFor(request)).toBe(first);
    expect(loaderRunnerFor(twin)).toBeUndefined();
    bindLoaderRunner(request, second);
    expect(loaderRunnerFor(request)).toBe(second);
  });
});

describe("withLoaderRunner", () => {
  it("binds the runner to each request before the wrapped renderer runs the page loaders", async () => {
    const ledger = memoryLedger();
    const runner = createActionLoaderRunner(source, { ledger });
    const wrapped = withLoaderRunner(createRexRenderer({ bundle }), runner);
    expect(Object.isFrozen(wrapped)).toBe(true);
    const request = new Request("http://rex.test/", { headers: { accept: "text/html" } });
    const result = await wrapped.render(request, await createRexContext(request, () => ada));
    expect(loaderRunnerFor(request)).toBe(runner);
    expect(result.kind).toBe("page");
    expect(result.page).toBe("portfolio");
    expect(await new Response(result.body).text()).toContain("Portfolio body");
    expect((await ledger.list()).map((record) => [record.actionId, record.outcome])).toEqual([
      ["list-holdings", "ok"],
    ]);
  });

  it("leaves a bare renderer without a runner, which refuses a page with loaders with REX408", async () => {
    const renderer = createRexRenderer({ bundle });
    const request = new Request("http://rex.test/", { headers: { accept: "text/html" } });
    await expect(
      renderer.render(request, await createRexContext(request, () => ada)),
    ).rejects.toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX408",
        message:
          'REX408 rex: page "portfolio" declares loaders but the request was not served by createRexServer',
      }),
    );
    expect(loaderRunnerFor(request)).toBeUndefined();
  });
});

describe("installLoaderRunner", () => {
  it("binds one runner built from the setup to every GET request and none to other methods", async () => {
    const ledger = memoryLedger();
    const seen: (LoaderRunner | undefined)[] = [];
    const app = new Hono();
    installLoaderRunner(app, setupFor({ registry: source, ledger, actor: () => ada }));
    app.all("/probe", async (c) => {
      const runner = loaderRunnerFor(c.req.raw);
      seen.push(runner);
      return c.json({
        bound: runner !== undefined,
        holdings: runner === undefined ? null : await runner.run(listHoldings, {}, context),
      });
    });
    const bound = { bound: true, holdings: { symbols: ["BTC", "ETH"] } };
    expect(await (await app.request("http://rex.test/probe")).json()).toEqual(bound);
    expect(
      await (
        await app.request("http://rex.test/probe?view=1", { headers: { accept: "text/html" } })
      ).json(),
    ).toEqual(bound);
    expect(await (await app.request("http://rex.test/probe", { method: "POST" })).json()).toEqual({
      bound: false,
      holdings: null,
    });
    expect(seen).toHaveLength(3);
    expect(seen[0]).toBeDefined();
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBeUndefined();
    expect(seen[0]?.telemetry).toBe(telemetryFor(ledger));
    expect((await ledger.list()).map((record) => record.actionId)).toEqual([
      "list-holdings",
      "list-holdings",
    ]);
  });
});

describe("runPageLoaders", () => {
  let ledger: Ledger;
  let runner: LoaderRunner;
  let queryClient: QueryClient;

  beforeEach(() => {
    ledger = memoryLedger();
    runner = createActionLoaderRunner(source, { ledger });
    queryClient = new QueryClient();
  });

  it("prefetches every loader of the page into the query client under its loader key", async () => {
    const params = { accountId: "acc-1" };
    const outcomes = await runPageLoaders({ page: account, params, context, queryClient, runner });
    const detailKey = loaderQueryKey("account", "detail", { id: "acc-1" });
    const mirrorKey = loaderQueryKey("account", "mirror", { id: "acc-1-mirror" });
    expect(outcomes).toEqual([
      { name: "detail", key: detailKey, ok: true, error: null },
      { name: "mirror", key: mirrorKey, ok: true, error: null },
    ]);
    expect(queryClient.getQueryData(detailKey)).toEqual({ id: "acc-1", by: "ada" });
    expect(queryClient.getQueryData(mirrorKey)).toEqual({ id: "acc-1-mirror", by: "ada" });
    expect(queryClient.getQueryState(detailKey)?.status).toBe("success");
    const records = await ledger.list();
    expect(records).toHaveLength(2);
    expect(new Set(records.map((record) => `${record.actionId}:${record.outcome}`))).toEqual(
      new Set(["read-account:ok"]),
    );
    const holdingsKey = loaderQueryKey("portfolio", "holdings", {});
    await expect(
      runPageLoaders({ page: portfolio, params: {}, context, queryClient, runner }),
    ).resolves.toEqual([{ name: "holdings", key: holdingsKey, ok: true, error: null }]);
    expect(queryClient.getQueryData(holdingsKey)).toEqual({ symbols: ["BTC", "ETH"] });
  });

  it("resolves to no outcomes for a page without loaders", async () => {
    await expect(
      runPageLoaders({ page: plain, params: {}, context, queryClient, runner }),
    ).resolves.toEqual([]);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(await ledger.list()).toEqual([]);
  });

  it("records a refused loader as a failed outcome carrying the loader error", async () => {
    const [outcome] = await runPageLoaders({
      page: vault,
      params: {},
      context,
      queryClient,
      runner,
    });
    const key = loaderQueryKey("vault", "secrets", {});
    expect(outcome?.name).toBe("secrets");
    expect(outcome?.key).toEqual(key);
    expect(outcome?.ok).toBe(false);
    expect(outcome?.error).toBeInstanceOf(RexLoaderError);
    expect(outcome?.error?.toJSON()).toEqual({
      name: "RexLoaderError",
      page: "vault",
      loader: "secrets",
      code: "FORBIDDEN",
      status: 403,
      message: expect.stringMatching(/^action "read-vault" is forbidden: /),
    });
    expect(queryClient.getQueryState(key)?.status).toBe("error");
    expect(queryClient.getQueryState(key)?.error).toBe(outcome?.error);
    expect(queryClient.getQueryData(key)).toBeUndefined();
    expect((await ledger.list()).map((record) => [record.actionId, record.outcome])).toEqual([
      ["read-vault", "FORBIDDEN"],
    ]);
  });

  it("reports an action the runner cannot find as NOT_FOUND", async () => {
    const narrow = createActionLoaderRunner({ actions: [listHoldings] }, { ledger });
    const [outcome] = await runPageLoaders({
      page: vault,
      params: {},
      context,
      queryClient,
      runner: narrow,
    });
    expect(outcome?.ok).toBe(false);
    expect(outcome?.error?.code).toBe("NOT_FOUND");
    expect(outcome?.error?.status).toBe(404);
    expect(outcome?.error?.message).toBe('unknown action "read-vault"');
    expect(outcome?.error?.page).toBe("vault");
    expect(outcome?.error?.loader).toBe("secrets");
    expect(await ledger.list()).toEqual([]);
  });

  it("traces each loader through the runner's telemetry with its outcome", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const lines: LogLine[] = [];
    bindTelemetry(
      ledger,
      createTelemetry({
        tracer: provider.getTracer("rex-loaders-direct"),
        logger: recordingLogger(lines),
      }),
    );
    await runPageLoaders({ page: portfolio, params: {}, context, queryClient, runner });
    await runPageLoaders({ page: vault, params: {}, context, queryClient, runner });
    expect(spansNamed(exporter, SPAN_LOADER).map((span) => span.attributes)).toEqual([
      {
        [ATTR_PAGE_ID]: "portfolio",
        [ATTR_ACTION_ID]: "list-holdings",
        [ATTR_ACTOR_ID]: "ada",
        [ATTR_OUTCOME]: "ok",
      },
      {
        [ATTR_PAGE_ID]: "vault",
        [ATTR_ACTION_ID]: "read-vault",
        [ATTR_ACTOR_ID]: "ada",
        [ATTR_OUTCOME]: "FORBIDDEN",
      },
    ]);
    expect(
      spansNamed(exporter, SPAN_ACTION).map((span) => span.attributes[ATTR_ACTION_ID]),
    ).toEqual(["list-holdings", "read-vault"]);
    expect(lines.filter((line) => line.level === "error")).toEqual([]);
  });
});
