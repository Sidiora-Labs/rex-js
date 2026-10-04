import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Route, Switch, useLocation, useSearch } from "wouter";
import type { Actor } from "../core/actor.ts";
import { parseRoute, type AnyPage } from "../core/page.ts";
import { evaluate, type PolicyResult } from "../core/policy.ts";
import { RESERVED_QUERY_KEYS, isReservedQueryKey } from "../core/protocol.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { z } from "../core/schema.ts";
import { useActor, useRegistry } from "./context.ts";

export { RESERVED_QUERY_KEYS };
export const DRAFT_QUERY_KEY = "draft";

export interface ParamIssue {
  readonly path: string;
  readonly message: string;
}

export interface PageResolution {
  readonly kind: "page";
  readonly page: AnyPage;
  readonly params: Readonly<Record<string, unknown>>;
  readonly search: string;
  readonly policy: PolicyResult;
  readonly recovery: AnyPage | null;
  readonly issues: readonly ParamIssue[];
}

export interface NotFoundResolution {
  readonly kind: "not-found";
  readonly path: string;
}

export type RouteResolution = PageResolution | NotFoundResolution;

export type ParamsResult =
  | { readonly ok: true; readonly params: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly issues: readonly ParamIssue[] };

export type HrefResult =
  | { readonly ok: true; readonly href: string }
  | { readonly ok: false; readonly issues: readonly ParamIssue[] };

function shapeOf(declared: AnyPage): Record<string, z.ZodType> {
  return declared.params.shape as Record<string, z.ZodType>;
}

function issuesOf(error: z.ZodError): ParamIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "params",
    message: issue.message,
  }));
}

export function coerceParam(schema: z.ZodType | undefined, raw: string): unknown {
  if (schema === undefined || schema.safeParse(raw).success) return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (schema.safeParse(parsed).success) return parsed;
  } catch {
    return raw;
  }
  return raw;
}

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function parsePageParams(
  declared: AnyPage,
  routeParams: Readonly<Record<string, string | undefined>>,
  search: string,
): ParamsResult {
  const shape = shapeOf(declared);
  const candidate: Record<string, unknown> = {};
  const query = new URLSearchParams(search);
  for (const [key, raw] of query) {
    if (isReservedQueryKey(key) || declared.routeParams.includes(key)) continue;
    if (!(key in shape)) continue;
    candidate[key] = coerceParam(shape[key], raw);
  }
  for (const name of declared.routeParams) {
    const raw = routeParams[name];
    if (raw !== undefined) candidate[name] = coerceParam(shape[name], decodeSegment(raw));
  }
  const parsed = declared.params.safeParse(candidate);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, params: Object.freeze({ ...(parsed.data as Record<string, unknown>) }) };
}

function serializeValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function pageHref(
  declared: AnyPage,
  params: unknown = {},
  extra: Readonly<Record<string, string>> = {},
): HrefResult {
  const input = params ?? {};
  const parsed = declared.params.safeParse(input);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  const values = input as Record<string, unknown>;
  const shape = shapeOf(declared);
  const issues: ParamIssue[] = [];
  const query: [string, string][] = [];
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (value === undefined || !(key in shape) || declared.routeParams.includes(key)) continue;
    if (isReservedQueryKey(key)) {
      issues.push({ path: key, message: `"${key}" is reserved by Rex URL invocation` });
      continue;
    }
    query.push([key, serializeValue(value)]);
  }
  const segments: string[] = [];
  for (const segment of parseRoute(declared.route).segments) {
    if (segment.kind === "static") {
      segments.push(segment.value);
      continue;
    }
    const value = values[segment.name];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      issues.push({ path: segment.name, message: "route params must be strings or numbers" });
      continue;
    }
    segments.push(encodeURIComponent(String(value)));
  }
  if (issues.length > 0) return { ok: false, issues };
  for (const key of Object.keys(extra).sort()) {
    query.push([key, extra[key] as string]);
  }
  const path = `/${segments.join("/")}`;
  const search = new URLSearchParams(query).toString();
  return { ok: true, href: search === "" ? path : `${path}?${search}` };
}

export function resolvePage(
  declared: AnyPage,
  routeParams: Readonly<Record<string, string | undefined>>,
  search: string,
  subject: Actor,
  registry: RegistrySnapshot,
): PageResolution {
  const policy = evaluate(declared.policy, subject);
  const recovery =
    declared.recovery === null ? null : (registry.find("page", declared.recovery) ?? null);
  const parsed = parsePageParams(declared, routeParams, search);
  return Object.freeze({
    kind: "page",
    page: declared,
    params: parsed.ok ? parsed.params : Object.freeze({}),
    search,
    policy,
    recovery,
    issues: parsed.ok ? Object.freeze([]) : Object.freeze([...parsed.issues]),
  });
}

function compareSegments(a: AnyPage, b: AnyPage): number {
  const left = parseRoute(a.route).segments;
  const right = parseRoute(b.route).segments;
  if (left.length !== right.length) return right.length - left.length;
  for (let index = 0; index < left.length; index++) {
    const l = left[index];
    const r = right[index];
    if (l === undefined || r === undefined || l.kind === r.kind) continue;
    return l.kind === "static" ? -1 : 1;
  }
  return a.route < b.route ? -1 : a.route > b.route ? 1 : 0;
}

export function orderPages(pages: readonly AnyPage[]): readonly AnyPage[] {
  return Object.freeze([...pages].sort(compareSegments));
}

export const ActiveRouteContext = createContext<RouteResolution | null>(null);
ActiveRouteContext.displayName = "RexActiveRoute";

export function useActiveRoute(): RouteResolution | null {
  return useContext(ActiveRouteContext);
}

export function useActivePage(): PageResolution | null {
  const resolution = useActiveRoute();
  return resolution !== null && resolution.kind === "page" ? resolution : null;
}

export type RouteRender = (resolution: RouteResolution) => ReactNode;

interface PageRouteProps {
  readonly page: AnyPage;
  readonly routeParams: Readonly<Record<string, string | undefined>>;
  readonly render: RouteRender;
}

function PageRoute({ page: declared, routeParams, render }: PageRouteProps) {
  const registry = useRegistry();
  const subject = useActor();
  const search = useSearch();
  const key = declared.routeParams.map((name) => routeParams[name] ?? "").join("/");
  const resolution = useMemo(
    () => resolvePage(declared, routeParams, search, subject, registry),
    [declared, key, search, subject, registry],
  );
  return (
    <ActiveRouteContext.Provider value={resolution}>{render(resolution)}</ActiveRouteContext.Provider>
  );
}

function NotFoundRoute({ render }: { readonly render: RouteRender }) {
  const [path] = useLocation();
  const resolution = useMemo<NotFoundResolution>(
    () => Object.freeze({ kind: "not-found", path }),
    [path],
  );
  return (
    <ActiveRouteContext.Provider value={resolution}>{render(resolution)}</ActiveRouteContext.Provider>
  );
}

export interface RexRoutesProps {
  readonly render: RouteRender;
}

export function RexRoutes({ render }: RexRoutesProps) {
  const registry = useRegistry();
  const pages = useMemo(() => orderPages(registry.pages), [registry]);
  return (
    <Switch>
      {pages.map((declared) => (
        <Route key={declared.id} path={declared.route}>
          {(routeParams: Record<string, string | undefined>) => (
            <PageRoute page={declared} routeParams={routeParams} render={render} />
          )}
        </Route>
      ))}
      <Route>
        <NotFoundRoute render={render} />
      </Route>
    </Switch>
  );
}

export function NotFound({ path }: { readonly path: string }) {
  return (
    <section role="alert" data-rex-app-state="not-found">
      <h1>Page not found</h1>
      <p>No page matches {path}.</p>
    </section>
  );
}
