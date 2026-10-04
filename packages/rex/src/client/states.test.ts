import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REX_DATA_STATES, type RexDataState } from "../core/states.ts";
import {
  DATA_STATE_PRECEDENCE,
  dataStateConditions,
  hasContent,
  isTerminalError,
  readOnline,
  resolveDataState,
  toDataStateQuery,
  useDataState,
  type DataStateInput,
  type DataStateQuery,
  type UseDataStateOptions,
} from "./states.ts";

const withData = (status: DataStateQuery["status"], error: unknown = null): DataStateQuery => ({
  status,
  fetchStatus: "idle",
  hasData: true,
  error,
});

const fetching: DataStateQuery = {
  status: "pending",
  fetchStatus: "fetching",
  hasData: false,
  error: null,
};
const idlePending: DataStateQuery = {
  status: "pending",
  fetchStatus: "idle",
  hasData: false,
  error: null,
};
const failed = (error: unknown): DataStateQuery => ({
  status: "error",
  fetchStatus: "idle",
  hasData: false,
  error,
});

interface Fragment {
  readonly queries?: readonly DataStateQuery[];
  readonly denied?: boolean;
  readonly offline?: boolean;
  readonly empty?: boolean;
}

const notFound = new ORPCError("NOT_FOUND", { message: "gone" });
const unavailable = new ORPCError("SERVICE_UNAVAILABLE", { message: "down" });

const FRAGMENTS: { readonly [S in RexDataState]: Fragment } = {
  "permission-denied": { denied: true },
  offline: { offline: true },
  loading: { queries: [fetching] },
  "terminal-error": { queries: [failed(notFound)] },
  "recoverable-error": { queries: [failed(unavailable)] },
  empty: { empty: true },
  partial: { queries: [withData("success"), idlePending] },
  stale: { queries: [withData("error", unavailable)] },
  ready: { queries: [withData("success")] },
};

function inputOf(...fragments: Fragment[]): DataStateInput {
  return {
    queries: fragments.flatMap((fragment) => fragment.queries ?? []),
    policy: { allowed: !fragments.some((fragment) => fragment.denied) },
    online: !fragments.some((fragment) => fragment.offline),
    hasData: !fragments.some((fragment) => fragment.empty),
  };
}

describe("resolveDataState", () => {
  it("documents the precedence over the closed set of nine states", () => {
    expect(DATA_STATE_PRECEDENCE).toEqual([
      "permission-denied",
      "offline",
      "loading",
      "terminal-error",
      "recoverable-error",
      "empty",
      "partial",
      "stale",
      "ready",
    ]);
    expect([...DATA_STATE_PRECEDENCE].sort()).toEqual([...REX_DATA_STATES].sort());
  });

  it.each(REX_DATA_STATES.map((state) => [state]))("resolves %s on its own", (state) => {
    expect(resolveDataState(inputOf(FRAGMENTS[state]))).toBe(state);
  });

  it("resolves ready for a page without queries", () => {
    expect(resolveDataState(inputOf())).toBe("ready");
  });

  const pairs: [RexDataState, RexDataState][] = [];
  DATA_STATE_PRECEDENCE.forEach((higher, index) => {
    for (const lower of DATA_STATE_PRECEDENCE.slice(index + 1)) pairs.push([higher, lower]);
  });

  it("covers every precedence pair", () => {
    expect(pairs).toHaveLength(36);
  });

  it.each(pairs)("prefers %s over %s", (higher, lower) => {
    const input = inputOf(FRAGMENTS[higher], FRAGMENTS[lower]);
    const held = dataStateConditions(input);
    expect(held.has(higher)).toBe(true);
    expect(held.has(lower)).toBe(true);
    expect(resolveDataState(input)).toBe(higher);
    expect(resolveDataState(inputOf(FRAGMENTS[lower], FRAGMENTS[higher]))).toBe(higher);
  });

  it("treats a refetch failure with data as stale, not as an error", () => {
    expect(resolveDataState(inputOf({ queries: [withData("error", notFound)] }))).toBe("stale");
  });

  it("does not count an idle pending query as loading", () => {
    expect(resolveDataState(inputOf({ queries: [idlePending] }))).toBe("ready");
    expect(dataStateConditions(inputOf({ queries: [idlePending] })).has("loading")).toBe(false);
  });

  it("counts a paused first fetch as loading", () => {
    const paused: DataStateQuery = { ...fetching, fetchStatus: "paused" };
    expect(resolveDataState(inputOf({ queries: [paused] }))).toBe("loading");
  });
});

describe("error and data classification", () => {
  it("classifies client errors as terminal and the rest as recoverable", () => {
    expect(isTerminalError(notFound)).toBe(true);
    expect(isTerminalError(new ORPCError("FORBIDDEN"))).toBe(true);
    expect(isTerminalError(new ORPCError("BAD_REQUEST"))).toBe(true);
    expect(isTerminalError(new ORPCError("TOO_MANY_REQUESTS"))).toBe(false);
    expect(isTerminalError(new ORPCError("TIMEOUT"))).toBe(false);
    expect(isTerminalError(unavailable)).toBe(false);
    expect(isTerminalError(new TypeError("fetch failed"))).toBe(false);
    expect(isTerminalError(null)).toBe(false);
  });

  it("recognises empty data", () => {
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(null)).toBe(false);
    expect(hasContent([])).toBe(false);
    expect(hasContent({ items: [], page: 1, size: 50, total: 0 })).toBe(false);
    expect(hasContent({ items: [1] })).toBe(true);
    expect(hasContent([0])).toBe(true);
    expect(hasContent(0)).toBe(true);
    expect(hasContent({ balance: "0" })).toBe(true);
  });

  it("normalises TanStack query results", () => {
    expect(
      toDataStateQuery({ status: "success", fetchStatus: "idle", data: [], error: null }),
    ).toEqual({ status: "success", fetchStatus: "idle", hasData: true, error: null });
  });

  it("reads connectivity from navigator.onLine", () => {
    expect(readOnline({ onLine: false })).toBe(false);
    expect(readOnline({ onLine: true })).toBe(true);
    expect(readOnline({})).toBe(true);
    expect(readOnline(undefined)).toBe(true);
  });
});

describe("useDataState", () => {
  function renderState(data: unknown, options: UseDataStateOptions = {}): string {
    const client = new QueryClient();
    client.setQueryData(["holdings"], data);
    function Probe() {
      const holdings = useQuery({
        queryKey: ["holdings"],
        queryFn: () => data,
        staleTime: Number.POSITIVE_INFINITY,
      });
      return createElement("p", null, useDataState([holdings], options));
    }
    return renderToStaticMarkup(
      createElement(QueryClientProvider, { client }, createElement(Probe)),
    );
  }

  it("observes TanStack query state", () => {
    expect(renderState([{ symbol: "PAX" }])).toBe("<p>ready</p>");
    expect(renderState([])).toBe("<p>empty</p>");
  });

  it("applies the page policy and an explicit data signal", () => {
    expect(renderState([1], { policy: { allowed: false } })).toBe("<p>permission-denied</p>");
    expect(renderState([], { hasData: true })).toBe("<p>ready</p>");
  });
});
