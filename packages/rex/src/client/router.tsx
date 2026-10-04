import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  Redirect,
  Route,
  Switch,
  matchRoute,
  useLocation,
  useRouter,
  useSearch,
  type Parser,
} from "wouter";
import type { Actor } from "../core/actor.ts";
import { parseRoute, type AnyPage, type PageTransition } from "../core/page.ts";
import { evaluate, type PolicyResult } from "../core/policy.ts";
import { RESERVED_QUERY_KEYS, isReservedQueryKey } from "../core/protocol.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { JsonSchema } from "../core/schema.ts";
import { issuePath, validateStandardSync, type StandardIssue } from "../core/standard.ts";
import type { Manifest } from "../manifest/types.ts";
import { useActor, useManifest, useRegistry } from "./context.ts";
import { useI18n } from "./i18n/context.ts";
import { localePrefix, localizeHref, stripLocalePrefix } from "./i18n/locale.ts";

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

export type ViewTransitionHost = Partial<Pick<Document, "startViewTransition">>;

function documentHost(): ViewTransitionHost | undefined {
  return typeof document === "undefined" ? undefined : document;
}

export function runRouteChange(
  transition: PageTransition,
  update: () => void,
  host: ViewTransitionHost | undefined = documentHost(),
): void {
  if (transition === "view" && typeof host?.startViewTransition === "function") {
    host.startViewTransition(() => {
      flushSync(update);
    });
    return;
  }
  update();
}

export type RouteChange = (target: AnyPage, href: string, options: { readonly replace: boolean }) => void;

export const RouteChangeContext = createContext<RouteChange | null>(null);
RouteChangeContext.displayName = "RexRouteChange";

export function useRouteChange(): RouteChange {
  const routes = useContext(RouteChangeContext);
  const [, navigate] = useLocation();
  const own = useCallback<RouteChange>(
    (target, href, { replace }) => runRouteChange(target.transition, () => navigate(href, { replace })),
    [navigate],
  );
  return routes ?? own;
}

export function useLocaleHref(): (href: string) => string {
  const { source, locale } = useI18n();
  const prefixed = source !== null && source.settings.routing === "prefix";
  return useCallback((href: string) => (prefixed ? localizeHref(href, locale) : href), [
    prefixed,
    locale,
  ]);
}

export const ROUTE_FOCUS_SELECTORS = ["[data-rex-shell] h1", "main h1", "h1", "main"] as const;

export function focusRouteTarget(root: ParentNode = document): HTMLElement | null {
  for (const selector of ROUTE_FOCUS_SELECTORS) {
    const target = root.querySelector<HTMLElement>(selector);
    if (target === null) continue;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    return target;
  }
  return null;
}

export const RouteChangesContext = createContext(0);
RouteChangesContext.displayName = "RexRouteChanges";

export function useRouteChanges(): number {
  return useContext(RouteChangesContext);
}

export type NavigationType = "push" | "replace" | "reload" | "traverse";

export interface NavigationDestinationLike {
  readonly url: string;
  readonly sameDocument: boolean;
}

export interface NavigationInterceptOptions {
  readonly handler?: () => Promise<void>;
  readonly focusReset?: "after-transition" | "manual";
  readonly scroll?: "after-transition" | "manual";
}

export interface NavigateEventLike extends Event {
  readonly navigationType: NavigationType;
  readonly canIntercept: boolean;
  readonly hashChange: boolean;
  readonly downloadRequest: string | null;
  readonly formData: FormData | null;
  readonly destination: NavigationDestinationLike;
  intercept(options?: NavigationInterceptOptions): void;
}

export type NavigationLike = EventTarget;

export function navigationHost(): NavigationLike | undefined {
  const candidate = (globalThis as { navigation?: unknown }).navigation;
  return candidate instanceof EventTarget ? candidate : undefined;
}

export interface RoutableDestination {
  readonly page: AnyPage;
  readonly href: string;
}

export interface DestinationScope {
  readonly pages: readonly AnyPage[];
  readonly origin: string;
  readonly base: string;
  readonly parser: Parser;
  readonly locales?: readonly string[] | null;
}

export function routableDestination(
  event: NavigateEventLike,
  { pages, origin, base, parser, locales = null }: DestinationScope,
): RoutableDestination | null {
  if (!event.canIntercept || event.hashChange || event.destination.sameDocument) return null;
  if (event.downloadRequest !== null || event.formData !== null) return null;
  if (event.navigationType !== "push" && event.navigationType !== "replace") return null;
  const url = new URL(event.destination.url);
  if (url.origin !== origin) return null;
  if (base !== "" && !url.pathname.toLowerCase().startsWith(base.toLowerCase())) return null;
  const path = url.pathname.slice(base.length) || "/";
  if (locales !== null && localePrefix(path, locales) === null) return null;
  const routed = locales === null ? path : stripLocalePrefix(path, locales);
  const target = pages.find((declared) => matchRoute(parser, declared.route, routed)[0]);
  if (target === undefined) return null;
  return { page: target, href: `${path}${url.search}${url.hash}` };
}

export interface RexRoutesProps {
  readonly render: RouteRender;
}

interface LocaleRedirectProps {
  readonly pages: readonly AnyPage[];
  readonly locale: string;
  readonly render: RouteRender;
}

function LocaleRedirect({ pages, locale, render }: LocaleRedirectProps) {
  const router = useRouter();
  const [path] = useLocation();
  const search = useSearch();
  const known = pages.some((declared) => matchRoute(router.parser, declared.route, path)[0]);
  if (!known) return <NotFoundRoute render={render} />;
  return <Redirect to={localizeHref(search === "" ? path : `${path}?${search}`, locale)} replace />;
}

export function RexRoutes({ render }: RexRoutesProps) {
  const registry = useRegistry();
  const router = useRouter();
  const [path] = useLocation();
  const change = useRouteChange();
  const { source, locale } = useI18n();
  const locales = source !== null && source.settings.routing === "prefix" ? source.settings.locales : null;
  const pages = useMemo(() => orderPages(registry.pages), [registry]);
  const [committed, setCommitted] = useState({ path, changes: 0 });
  const changes = committed.path === path ? committed.changes : committed.changes + 1;
  if (committed.path !== path) setCommitted({ path, changes });

  useEffect(() => {
    if (changes === 0) return;
    focusRouteTarget(document);
  }, [changes]);

  useEffect(() => {
    const navigation = navigationHost();
    if (navigation === undefined) return;
    const scope: DestinationScope = {
      pages,
      origin: globalThis.location.origin,
      base: router.base,
      parser: router.parser,
      locales,
    };
    const onNavigate = (event: Event) => {
      const destination = routableDestination(event as NavigateEventLike, scope);
      if (destination === null) return;
      (event as NavigateEventLike).intercept({
        focusReset: "manual",
        handler: async () => change(destination.page, destination.href, { replace: true }),
      });
    };
    navigation.addEventListener("navigate", onNavigate);
    return () => navigation.removeEventListener("navigate", onNavigate);
  }, [pages, router, change, locales]);

  const routes = (
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

  return (
    <RouteChangesContext.Provider value={changes}>
      <RouteChangeContext.Provider value={change}>
        {locales === null ? (
          routes
        ) : (
          <Switch>
            {locales.map((prefix) => (
              <Route key={prefix} path={`/${prefix}`} nest>
                {routes}
              </Route>
            ))}
            <Route>
              <LocaleRedirect pages={pages} locale={locale} render={render} />
            </Route>
          </Switch>
        )}
      </RouteChangeContext.Provider>
    </RouteChangesContext.Provider>
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
