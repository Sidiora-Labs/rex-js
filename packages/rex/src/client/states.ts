import { useSyncExternalStore } from "react";
import { isPlainObject } from "../core/entity.ts";
import type { PolicyResult } from "../core/policy.ts";
import type { RexDataState } from "../core/states.ts";
import { useActivePage } from "./router.tsx";

export const DATA_STATE_PRECEDENCE: readonly RexDataState[] = Object.freeze([
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

export type QueryStatus = "pending" | "error" | "success";
export type FetchStatus = "fetching" | "paused" | "idle";

export interface DataStateQuery {
  readonly status: QueryStatus;
  readonly fetchStatus: FetchStatus;
  readonly hasData: boolean;
  readonly error: unknown;
}

export interface DataStateInput {
  readonly queries: readonly DataStateQuery[];
  readonly policy: Pick<PolicyResult, "allowed">;
  readonly online: boolean;
  readonly hasData: boolean;
}

export interface QueryLike {
  readonly status: QueryStatus;
  readonly fetchStatus: FetchStatus;
  readonly data: unknown;
  readonly error: unknown;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429]);

export function isTerminalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== "number") return false;
  return status >= 400 && status < 500 && !RETRYABLE_STATUSES.has(status);
}

function erroredWithoutData(query: DataStateQuery): boolean {
  return query.status === "error" && !query.hasData;
}

export function dataStateConditions(input: DataStateInput): ReadonlySet<RexDataState> {
  const { queries } = input;
  const held = new Set<RexDataState>(["ready"]);
  if (!input.policy.allowed) held.add("permission-denied");
  if (!input.online) held.add("offline");
  if (queries.some((q) => q.status === "pending" && !q.hasData && q.fetchStatus !== "idle")) {
    held.add("loading");
  }
  if (queries.some((q) => erroredWithoutData(q) && isTerminalError(q.error))) {
    held.add("terminal-error");
  }
  if (queries.some((q) => erroredWithoutData(q) && !isTerminalError(q.error))) {
    held.add("recoverable-error");
  }
  if (!input.hasData) held.add("empty");
  const succeeded = queries.some((q) => q.status === "success");
  const missing = queries.some(
    (q) => q.status !== "success" && !(q.status === "error" && q.hasData),
  );
  if (succeeded && missing) held.add("partial");
  if (queries.some((q) => q.status === "error" && q.hasData)) held.add("stale");
  return held;
}

export function resolveDataState(input: DataStateInput): RexDataState {
  const held = dataStateConditions(input);
  for (const state of DATA_STATE_PRECEDENCE) {
    if (held.has(state)) return state;
  }
  return "ready";
}

export function hasContent(data: unknown): boolean {
  if (data === undefined || data === null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (isPlainObject(data) && Array.isArray(data.items)) return data.items.length > 0;
  return true;
}

export function toDataStateQuery(query: QueryLike): DataStateQuery {
  return {
    status: query.status,
    fetchStatus: query.fetchStatus,
    hasData: query.data !== undefined,
    error: query.error,
  };
}

export function readOnline(
  source: { readonly onLine?: unknown } | undefined = globalThis.navigator,
): boolean {
  return source?.onLine !== false;
}

function subscribeOnline(listener: () => void): () => void {
  const target = globalThis.window;
  if (target === undefined) return () => {};
  target.addEventListener("online", listener);
  target.addEventListener("offline", listener);
  return () => {
    target.removeEventListener("online", listener);
    target.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => readOnline(),
    () => true,
  );
}

export interface UseDataStateOptions {
  readonly policy?: Pick<PolicyResult, "allowed">;
  readonly hasData?: boolean;
}

const ALLOWED: Pick<PolicyResult, "allowed"> = Object.freeze({ allowed: true });

export function useDataState(
  pageQueries: readonly QueryLike[],
  options: UseDataStateOptions = {},
): RexDataState {
  const online = useOnline();
  const active = useActivePage();
  const policy = options.policy ?? active?.policy ?? ALLOWED;
  const queries = pageQueries.map(toDataStateQuery);
  const hasData =
    options.hasData ??
    (pageQueries.length === 0 || pageQueries.some((query) => hasContent(query.data)));
  return resolveDataState({ queries, policy, online, hasData });
}
