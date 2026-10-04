import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Route, Switch, useLocation, useSearch } from "wouter";
import type { Actor } from "../core/actor.ts";
import { parseRoute, type AnyPage } from "../core/page.ts";
import { evaluate, type PolicyResult } from "../core/policy.ts";
import { RESERVED_QUERY_KEYS, isReservedQueryKey } from "../core/protocol.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { JsonSchema } from "../core/schema.ts";
import { issuePath, validateStandardSync, type StandardIssue } from "../core/standard.ts";
import type { Manifest } from "../manifest/types.ts";
import { useActor, useManifest, useRegistry } from "./context.ts";

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

type JsonSchemaMap = Readonly<Record<string, JsonSchema>>;

function propertiesOf(schema: JsonSchema): JsonSchemaMap {
  const properties = schema.properties;
  return typeof properties === "object" && properties !== null && !Array.isArray(properties)
    ? (properties as JsonSchemaMap)
    : {};
}

function acceptsExtraKeys(schema: JsonSchema): boolean {
  const extra = schema.additionalProperties;
  return extra === true || (typeof extra === "object" && extra !== null);
}

export function paramKeyAccepted(schema: JsonSchema, key: string): boolean {
  return Object.hasOwn(propertiesOf(schema), key) || acceptsExtraKeys(schema);
}

export function manifestParamsSchema(manifest: Manifest, declared: AnyPage): JsonSchema {
  const listed = manifest.pages.find((entry) => entry.id === declared.id);
  if (listed === undefined) {
    throw new Error(`rex: the manifest does not list page "${declared.id}"`);
  }
  return listed.params;
}

function issuesOf(issues: readonly StandardIssue[]): ParamIssue[] {
  return issues.map((issue) => ({
    path: issuePath(issue) || "params",
    message: issue.message,
  }));
}

function validateParams(declared: AnyPage, value: unknown): ParamsResult {
  const result = validateStandardSync(declared.params, value);
  if (result.issues !== undefined) return { ok: false, issues: issuesOf(result.issues) };
  return { ok: true, params: Object.freeze({ ...(result.value as Record<string, unknown>) }) };
}

function admitsString(schema: JsonSchema): boolean {
  const type = schema.type;
  if (type === "string") return true;
  if (Array.isArray(type)) return type.includes("string");
  if (type !== undefined) return false;
  if (Array.isArray(schema.enum)) return schema.enum.every((value) => typeof value === "string");
  if ("const" in schema) return typeof schema.const === "string";
  for (const key of ["anyOf", "oneOf"] as const) {
    const branches = schema[key];
    if (Array.isArray(branches)) {
      return branches.some(
        (branch) => typeof branch === "object" && branch !== null && admitsString(branch as JsonSchema),
      );
    }
  }
  return true;
}

export function coerceParam(schema: JsonSchema | undefined, raw: string): unknown {
  if (schema === undefined || admitsString(schema)) return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
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
  paramsSchema: JsonSchema = declared.paramsJsonSchema,
): ParamsResult {
  const properties = propertiesOf(paramsSchema);
  const candidate: Record<string, unknown> = {};
  const query = new URLSearchParams(search);
  for (const [key, raw] of query) {
    if (isReservedQueryKey(key) || declared.routeParams.includes(key)) continue;
    if (!paramKeyAccepted(paramsSchema, key)) continue;
    candidate[key] = coerceParam(properties[key], raw);
  }
  for (const name of declared.routeParams) {
    const raw = routeParams[name];
    if (raw !== undefined) candidate[name] = coerceParam(properties[name], decodeSegment(raw));
  }
  return validateParams(declared, candidate);
}

function serializeValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function pageHref(
  declared: AnyPage,
  params: unknown = {},
  extra: Readonly<Record<string, string>> = {},
  paramsSchema: JsonSchema = declared.paramsJsonSchema,
): HrefResult {
  const input = params ?? {};
  const parsed = validateParams(declared, input);
  if (!parsed.ok) return parsed;
  const values = input as Record<string, unknown>;
  const issues: ParamIssue[] = [];
  const query: [string, string][] = [];
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (
      value === undefined ||
      !paramKeyAccepted(paramsSchema, key) ||
      declared.routeParams.includes(key)
    ) {
      continue;
    }
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
  paramsSchema: JsonSchema = declared.paramsJsonSchema,
): PageResolution {
  const policy = evaluate(declared.policy, subject);
  const recovery =
    declared.recovery === null ? null : (registry.find("page", declared.recovery) ?? null);
  const parsed = parsePageParams(declared, routeParams, search, paramsSchema);
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
  const manifest = useManifest();
  const subject = useActor();
  const search = useSearch();
  const key = declared.routeParams.map((name) => routeParams[name] ?? "").join("/");
  const resolution = useMemo(
    () =>
      resolvePage(
        declared,
        routeParams,
        search,
        subject,
        registry,
        manifestParamsSchema(manifest, declared),
      ),
    [declared, key, search, subject, registry, manifest],
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
