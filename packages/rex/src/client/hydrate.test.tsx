import { QueryClient, dehydrate } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RexError, isRexError } from "../core/errors.ts";
import {
  RexLoaderError,
  isServerSeeded,
  loaderQueryKey,
  shouldDehydrateRexQuery,
} from "./loaders.ts";
import { SSR_ATTRIBUTE as DECLARED_SSR_ATTRIBUTE } from "./ssr-attribute.ts";
import {
  CLIENT_RENDER_DIGEST,
  HYDRATION_MISMATCH_CODE,
  REX_DATA_ELEMENT_ID,
  REX_DATA_MIME_TYPE,
  REX_DATA_VERSION,
  RexDataError,
  SSR_ATTRIBUTE,
  hydrateQueries,
  isClientRenderHandoff,
  isServerRendered,
  parseRexData,
  readRexData,
  recoverableErrorHandler,
  reportToConsole,
  serializeRexData,
  type HydrationMismatch,
  type RexDataPayload,
} from "./hydrate.ts";

const payload: RexDataPayload = {
  version: REX_DATA_VERSION,
  page: "notes",
  actor: {
    id: "owner",
    roles: ["admin"],
    permissions: ["notes.read"],
    attributes: { unlocked: true },
  },
  queries: { mutations: [], queries: [] },
};

function dataScript(content: string, id: string = REX_DATA_ELEMENT_ID): HTMLScriptElement {
  const script = document.createElement("script");
  script.type = REX_DATA_MIME_TYPE;
  script.id = id;
  script.textContent = content;
  return script;
}

function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return null;
}

function expectDataError(error: unknown, detail: string): void {
  expect(error).toBeInstanceOf(RexDataError);
  expect(error).toBeInstanceOf(RexError);
  expect(isRexError(error) && error.code).toBe("REX312");
  expect(error).toMatchObject({ name: "RexDataError", detail: `rex data: ${detail}` });
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("rex data", () => {
  it("declares the script contract the server emits", () => {
    expect(REX_DATA_MIME_TYPE).toBe("application/rex+data");
    expect(REX_DATA_ELEMENT_ID).toBe("rex-data");
    expect(REX_DATA_VERSION).toBe(1);
    expect(SSR_ATTRIBUTE).toBe(DECLARED_SSR_ATTRIBUTE);
    expect(SSR_ATTRIBUTE).toBe("data-rex-ssr");
    expect(HYDRATION_MISMATCH_CODE).toBe("REX310");
    expect(CLIENT_RENDER_DIGEST).toBe("rex:client-render");
    const error = new RexDataError("boom");
    expect(error.message).toBe("REX312 rex data: boom");
    expectDataError(error, "boom");
  });

  it("serialises the payload as inline-safe JSON that parses back unchanged", () => {
    const hostile: RexDataPayload = {
      ...payload,
      actor: { ...payload.actor, id: "</script><b>&amp;\u2028end" },
    };
    const serialized = serializeRexData(hostile);
    expect(serialized).not.toMatch(/[<>&\u2028]/);
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(serialized)).toEqual(hostile);
    expect(parseRexData(JSON.parse(serialized))).toEqual(hostile);
  });

  it("accepts a well-formed payload and rejects each malformed shape with REX312", () => {
    expect(parseRexData(payload)).toBe(payload);
    expect(parseRexData({ ...payload, page: null }).page).toBeNull();
    expect(parseRexData({ ...payload, actor: { id: "guest" } }).actor).toEqual({ id: "guest" });
    expectDataError(
      thrownBy(() => parseRexData("x")),
      "the payload must be a JSON object",
    );
    expectDataError(
      thrownBy(() => parseRexData([])),
      "the payload must be a JSON object",
    );
    expectDataError(
      thrownBy(() => parseRexData({ ...payload, version: 2 })),
      "version 2 is not 1",
    );
    expectDataError(
      thrownBy(() => parseRexData({ ...payload, page: 7 })),
      "page must be a page id or null",
    );
    for (const actor of [
      null,
      { roles: [] },
      { id: "owner", roles: [1] },
      { id: "owner", permissions: "all" },
      { id: "owner", attributes: [] },
    ]) {
      expectDataError(
        thrownBy(() => parseRexData({ ...payload, actor })),
        "actor must be an actor object",
      );
    }
    for (const queries of [null, { queries: [] }, { queries: {}, mutations: [] }]) {
      expectDataError(
        thrownBy(() => parseRexData({ ...payload, queries })),
        "queries must be a dehydrated TanStack Query state",
      );
    }
  });

  it("reads the single rex data script of a document or returns null without one", () => {
    expect(readRexData()).toBeNull();
    expect(readRexData(document.createElement("div"))).toBeNull();
    document.head.appendChild(dataScript(serializeRexData(payload)));
    expect(readRexData()).toEqual(payload);
    expect(readRexData(document)).toEqual(payload);
    document.head.appendChild(dataScript("{}", "something-else"));
    expect(readRexData()).toEqual(payload);
    const html = [
      "<!doctype html><html><head>",
      `<script type="${REX_DATA_MIME_TYPE}" id="${REX_DATA_ELEMENT_ID}" nonce="abc">`,
      serializeRexData({ ...payload, page: null }),
      `</script></head><body><div id="root" ${SSR_ATTRIBUTE}=""></div></body></html>`,
    ].join("");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(readRexData(parsed)?.page).toBeNull();
    expect(readRexData(parsed)?.actor).toEqual(payload.actor);
    expect(isServerRendered(parsed.getElementById("root") as Element)).toBe(true);
  });

  it("rejects non-JSON, malformed and duplicate scripts with REX312", () => {
    document.head.appendChild(dataScript("{not json"));
    expectDataError(
      thrownBy(() => readRexData()),
      `the ${REX_DATA_MIME_TYPE} script is not JSON`,
    );
    document.head.innerHTML = "";
    document.head.appendChild(dataScript(JSON.stringify({ ...payload, version: 0 })));
    expectDataError(
      thrownBy(() => readRexData()),
      "version 0 is not 1",
    );
    document.body.appendChild(dataScript(serializeRexData(payload)));
    expectDataError(
      thrownBy(() => readRexData()),
      `expected one ${REX_DATA_MIME_TYPE} script, found 2`,
    );
  });

  it("detects server-rendered roots by the ssr attribute", () => {
    const root = document.createElement("div");
    expect(isServerRendered(root)).toBe(false);
    root.setAttribute(SSR_ATTRIBUTE, "");
    expect(isServerRendered(root)).toBe(true);
    root.removeAttribute(SSR_ATTRIBUTE);
    expect(isServerRendered(root)).toBe(false);
  });
});

describe("hydrateQueries", () => {
  it("restores dehydrated queries and adopts loader results as seeded data or revived errors", async () => {
    const server = new QueryClient();
    const notesKey = loaderQueryKey("notes", "notes", {});
    const feedKey = loaderQueryKey("broken", "feed", { topic: "x" });
    await server.prefetchQuery({ queryKey: notesKey, queryFn: () => ({ items: ["First"] }) });
    await server.prefetchQuery({
      queryKey: feedKey,
      queryFn: () => {
        throw new RexLoaderError({
          page: "broken",
          loader: "feed",
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "the feed store is down",
        });
      },
      retry: false,
    });
    await server.prefetchQuery({ queryKey: ["notes"], queryFn: () => ["First"] });
    await server.prefetchQuery({
      queryKey: ["flaky"],
      queryFn: () => {
        throw new Error("not a loader");
      },
      retry: false,
    });
    const data: RexDataPayload = {
      ...payload,
      queries: dehydrate(server, { shouldDehydrateQuery: shouldDehydrateRexQuery }),
    };
    expect(data.queries.queries.map((query) => query.queryKey)).toEqual([
      notesKey,
      feedKey,
      ["notes"],
    ]);
    const wire = parseRexData(JSON.parse(serializeRexData(data)));
    const client = new QueryClient();
    hydrateQueries(client, wire);
    const cache = client.getQueryCache();

    const notes = cache.find({ queryKey: notesKey, exact: true });
    expect(notes?.state.data).toEqual({ items: ["First"] });
    expect(notes !== undefined && isServerSeeded(notes)).toBe(true);
    const plain = cache.find({ queryKey: ["notes"], exact: true });
    expect(plain?.state.data).toEqual(["First"]);
    expect(plain !== undefined && isServerSeeded(plain)).toBe(false);
    const feed = cache.find({ queryKey: feedKey, exact: true });
    expect(feed?.state.status).toBe("error");
    expect(feed?.state.error).toBeInstanceOf(RexLoaderError);
    expect(feed?.state.error).toMatchObject({
      page: "broken",
      loader: "feed",
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "the feed store is down",
    });
    expect(feed?.state.fetchFailureReason).toBe(feed?.state.error);
    expect(cache.find({ queryKey: ["flaky"], exact: true })).toBeUndefined();
  });
});

describe("recoverableErrorHandler", () => {
  it("reports hydration mismatches in dev with the component stack", () => {
    const reports: HydrationMismatch[] = [];
    const handle = recoverableErrorHandler({
      dev: true,
      report: (mismatch) => {
        reports.push(mismatch);
      },
    });
    const error = new Error("text mismatch");
    handle(error, { componentStack: "\n    at Shell" });
    handle("plain failure", {});
    expect(reports).toEqual([
      { code: "REX310", message: "text mismatch", componentStack: "\n    at Shell", error },
      { code: "REX310", message: "plain failure", componentStack: null, error: "plain failure" },
    ]);
  });

  it("ignores the client-render handoff signalled by the server renderer", () => {
    const reports: HydrationMismatch[] = [];
    const handle = recoverableErrorHandler({
      dev: true,
      report: (mismatch) => {
        reports.push(mismatch);
      },
    });
    const handoff = Object.assign(new Error("client render"), { digest: CLIENT_RENDER_DIGEST });
    handle(handoff, {});
    handle(new Error("wrapped", { cause: handoff }), {});
    handle({ digest: CLIENT_RENDER_DIGEST }, {});
    expect(reports).toEqual([]);
    expect(isClientRenderHandoff(handoff)).toBe(true);
    expect(
      isClientRenderHandoff(new Error("wrapped", { cause: { digest: CLIENT_RENDER_DIGEST } })),
    ).toBe(true);
    expect(isClientRenderHandoff(new Error("other"))).toBe(false);
    expect(isClientRenderHandoff(Object.assign(new Error("x"), { digest: "other" }))).toBe(false);
    expect(isClientRenderHandoff(null)).toBe(false);
    expect(isClientRenderHandoff(CLIENT_RENDER_DIGEST)).toBe(false);
    expect(isClientRenderHandoff(new Error("x", { cause: CLIENT_RENDER_DIGEST }))).toBe(false);
  });

  it("logs through the console by default", () => {
    const logged = vi.spyOn(console, "error");
    reportToConsole({
      code: HYDRATION_MISMATCH_CODE,
      message: "attr mismatch",
      componentStack: "    at Nav",
      error: null,
    });
    reportToConsole({
      code: HYDRATION_MISMATCH_CODE,
      message: "attr mismatch",
      componentStack: null,
      error: null,
    });
    recoverableErrorHandler({ dev: true })(new Error("via handler"), {
      componentStack: "    at Body",
    });
    expect(logged.mock.calls).toEqual([
      ["rex REX310: hydration mismatch: attr mismatch\n    at Nav"],
      ["rex REX310: hydration mismatch: attr mismatch"],
      ["rex REX310: hydration mismatch: via handler\n    at Body"],
    ]);
  });

  it("hands production errors to reportError and stays quiet without it", () => {
    const reports: HydrationMismatch[] = [];
    const handle = recoverableErrorHandler({
      dev: false,
      report: (mismatch) => {
        reports.push(mismatch);
      },
    });
    const error = new Error("prod mismatch");
    const scope = globalThis as { reportError?: (error: unknown) => void };
    const original = scope.reportError;
    const received: unknown[] = [];
    const onError = (event: Event) => {
      received.push((event as ErrorEvent).error);
    };
    window.addEventListener("error", onError);
    try {
      delete scope.reportError;
      handle(error, {});
      expect(received).toEqual([]);
      scope.reportError = (reported) => {
        window.dispatchEvent(new ErrorEvent("error", { error: reported }));
      };
      handle(error, {});
      handle(Object.assign(new Error("handoff"), { digest: CLIENT_RENDER_DIGEST }), {});
    } finally {
      if (original === undefined) delete scope.reportError;
      else scope.reportError = original;
      window.removeEventListener("error", onError);
    }
    expect(received).toEqual([error]);
    expect(reports).toEqual([]);
  });
});
