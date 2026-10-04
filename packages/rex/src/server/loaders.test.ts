import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import type { RexEntryBundle } from "../client/entry.tsx";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import type { RexLogger } from "../core/config.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always, never } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text } from "../core/schema.ts";
import { buildManifest } from "../manifest/build.ts";
import { createRexServer } from "./app.ts";
import { memoryLedger, type Ledger } from "./audit.ts";
import { loaderRunnerFor } from "./loaders.ts";
import {
  ATTR_ACTION_ID,
  ATTR_ACTOR_ID,
  ATTR_OUTCOME,
  ATTR_PAGE_ID,
  SPAN_ACTION,
  SPAN_LOADER,
  SPAN_RENDER,
  telemetryFor,
} from "./middleware/telemetry.ts";
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
