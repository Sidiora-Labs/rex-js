import { useQueryClient, type Query } from "@tanstack/react-query";
import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import type { ActionInput, AnyAction } from "../core/action.ts";
import { RexError } from "../core/errors.ts";
import { regionAddress, regionName } from "../core/ids.ts";
import type { AnyPage, PageStatesModule } from "../core/page.ts";
import { titleFromId } from "../core/page.ts";
import {
  STATE_EXPORT_NAMES,
  requiredStateExports,
  type RexDataState,
  type StateProps,
} from "../core/states.ts";
import type { ActResult, RunOptions } from "./act.ts";
import { AddressScope } from "./agent/address.tsx";
import { ConfirmContext, ConfirmProvider, useInvoke, type InvokeHandle } from "./agent/confirm.tsx";
import { PageStatesContext, RegionBoundary } from "./boundary.tsx";
import { pageLoaderQueryHashes, usePageLoaderQueries } from "./loaders.ts";
import { useNav, type Nav } from "./nav.ts";
import { useActivePage, type PageResolution } from "./router.tsx";
import { useDataState } from "./states.ts";

export type PageParamsValue = Readonly<Record<string, unknown>>;

export interface PageRuntime {
  readonly page: AnyPage;
  readonly params: PageParamsValue;
  readonly state: RexDataState;
  readonly resolution: PageResolution;
}

export const PageRuntimeContext = createContext<PageRuntime | null>(null);
PageRuntimeContext.displayName = "RexPage";

export function usePageRuntime(): PageRuntime {
  const runtime = useContext(PageRuntimeContext);
  if (runtime === null) throw new RexError("REX306", "rex: this component must render inside a PageHost");
  return runtime;
}

export interface ViewContext<P = PageParamsValue> {
  readonly params: P;
  readonly state: RexDataState;
}

export type ViewComponent = ComponentType & { readonly rexKind: "view" };

export function view<P = PageParamsValue>(render: (ctx: ViewContext<P>) => ReactNode): ViewComponent {
  if (typeof render !== "function") throw new RexError("REX313", "view: render must be a function");
  function RexView() {
    const runtime = usePageRuntime();
    return <>{render({ params: runtime.params as P, state: runtime.state })}</>;
  }
  return Object.assign(RexView, { rexKind: "view" as const });
}

export function useRegionAct<A extends AnyAction>(declared: A): InvokeHandle<A> {
  const handle = useInvoke(declared);
  const { invoke, run } = handle;
  const confirmed = useCallback(
    (input: ActionInput<A>, options: RunOptions = {}): Promise<ActResult<A>> =>
      options.confirmToken === undefined ? invoke(input) : run(input, options),
    [invoke, run],
  );
  return { ...handle, run: confirmed };
}

export interface RegionContext<P = PageParamsValue> {
  readonly page: string;
  readonly region: string;
  readonly params: P;
  readonly state: RexDataState;
  readonly act: typeof useRegionAct;
  readonly nav: Nav;
}

export type RegionComponent = ComponentType & {
  readonly rexKind: "region";
  readonly regionName: string;
};

export interface RegionProps {
  readonly name: string;
  readonly children?: ReactNode;
}

export function Region({ name, children }: RegionProps) {
  const runtime = usePageRuntime();
  const confirm = useContext(ConfirmContext);
  if (!runtime.page.regions.includes(name)) {
    throw new RexError("REX307", `rex: region "${name}" is not declared by page "${runtime.page.id}"`);
  }
  const scoped = <AddressScope region={name}>{children}</AddressScope>;
  return (
    <section aria-label={titleFromId(name)} data-rex-region={regionAddress(runtime.page.id, name)}>
      <RegionBoundary region={name}>
        {confirm === null ? <ConfirmProvider>{scoped}</ConfirmProvider> : scoped}
      </RegionBoundary>
    </section>
  );
}

export function region<P = PageParamsValue>(
  name: string,
  render: (ctx: RegionContext<P>) => ReactNode,
): RegionComponent {
  regionName(name);
  if (typeof render !== "function") throw new RexError("REX313", "region: render must be a function");
  function RegionBody() {
    const runtime = usePageRuntime();
    const nav = useNav();
    return (
      <>
        {render({
          page: runtime.page.id,
          region: name,
          params: runtime.params as P,
          state: runtime.state,
          act: useRegionAct,
          nav,
        })}
      </>
    );
  }
  function RexRegion() {
    return (
      <Region name={name}>
        <RegionBody />
      </Region>
    );
  }
  return Object.assign(RexRegion, { rexKind: "region" as const, regionName: name });
}

export type StateExportComponent = ComponentType<StateProps<PageParamsValue>>;

export interface EagerPageModuleSet<Pg extends AnyPage = AnyPage> {
  readonly page: Pg;
  readonly view: ComponentType;
  readonly states: PageStatesModule<Pg>;
  readonly regions?: Readonly<Record<string, ComponentType>>;
  readonly overlays?: Readonly<Record<string, ComponentType>>;
}

export interface LoadedPageModules {
  readonly view: unknown;
  readonly states: Readonly<Record<string, unknown>>;
  readonly regions?: Readonly<Record<string, unknown>>;
  readonly overlays?: Readonly<Record<string, unknown>>;
}

export interface LazyPageModuleSet<Pg extends AnyPage = AnyPage> {
  readonly page: Pg;
  readonly chunk?: string;
  load(): Promise<LoadedPageModules>;
}

export type PageModuleSet<Pg extends AnyPage = AnyPage> =
  EagerPageModuleSet<Pg> | LazyPageModuleSet<Pg>;

export function isLazyPageModules(modules: PageModuleSet): modules is LazyPageModuleSet {
  return typeof (modules as { load?: unknown }).load === "function";
}

export class RexPageModuleError extends RexError {
  readonly page: string;

  constructor(page: string, problem: string) {
    super("REX313", `page "${page}" modules: ${problem}`);
    this.name = "RexPageModuleError";
    this.page = page;
  }
}

function sameNames(page: string, kind: string, declared: readonly string[], provided: string[]) {
  const missing = declared.filter((name) => !provided.includes(name));
  const extra = provided.filter((name) => !declared.includes(name));
  if (missing.length > 0) throw new RexPageModuleError(page, `missing ${kind} ${missing.join(", ")}`);
  if (extra.length > 0) throw new RexPageModuleError(page, `undeclared ${kind} ${extra.join(", ")}`);
}

export function definePageModules<Pg extends AnyPage>(
  modules: EagerPageModuleSet<Pg>,
): EagerPageModuleSet<Pg> {
  const declared = modules.page;
  if (declared === undefined || declared.kind !== "page") {
    throw new RexError("REX313", "definePageModules: page must be a page declaration");
  }
  if (typeof modules.view !== "function") {
    throw new RexPageModuleError(declared.id, "view.tsx must default-export a component");
  }
  const states = modules.states as Readonly<Record<string, unknown>>;
  for (const name of requiredStateExports(declared.states)) {
    if (typeof states[name] !== "function") {
      throw new RexPageModuleError(declared.id, `states.tsx must export ${name}`);
    }
  }
  sameNames(declared.id, "regions", declared.regions, Object.keys(modules.regions ?? {}));
  for (const [name, component] of Object.entries(modules.regions ?? {})) {
    if (typeof component !== "function") {
      throw new RexPageModuleError(declared.id, `region ${name} must be a component`);
    }
  }
  sameNames(
    declared.id,
    "overlays",
    declared.overlays.map((overlay) => overlay.id),
    Object.keys(modules.overlays ?? {}),
  );
  return Object.freeze({ ...modules });
}

export function pageQueryScope(resolution: PageResolution): string {
  return `${resolution.page.id}:${JSON.stringify(resolution.params)}`;
}

function settledOrFetching(query: Query): boolean {
  return query.state.status !== "pending" || query.state.fetchStatus !== "idle";
}

export function usePageQueries(scope: string): readonly Query[] {
  const cache = useQueryClient().getQueryCache();
  const active = useActivePage();
  const observed = () => new Set(cache.getAll().filter((query) => query.getObserversCount() > 0));
  const tracked = useRef<{ scope: string; queries: Set<Query> } | null>(null);
  if (tracked.current === null || tracked.current.scope !== scope) {
    tracked.current = { scope, queries: observed() };
  }
  if (active !== null && pageQueryScope(active) === scope) {
    for (const hash of pageLoaderQueryHashes(active.page, active.params)) {
      const query = cache.get(hash);
      if (query !== undefined && settledOrFetching(query)) tracked.current.queries.add(query);
    }
  }
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  useLayoutEffect(() => {
    const queries = (tracked.current as { queries: Set<Query> }).queries;
    return cache.subscribe((event) => {
      if (event.type === "observerAdded") {
        if (!queries.has(event.query)) {
          queries.add(event.query);
          refresh();
        }
      } else if (event.type === "removed") {
        if (queries.delete(event.query)) refresh();
      } else if (event.type === "updated" && queries.has(event.query)) {
        refresh();
      }
    });
  }, [cache, scope]);

  return [...tracked.current.queries];
}

const STATE_TEXT: { readonly [S in RexDataState]: string } = {
  loading: "Loading",
  empty: "Nothing here yet",
  stale: "Showing saved data; refresh failed",
  partial: "Some content is unavailable",
  offline: "You are offline",
  "permission-denied": "You do not have access to this page",
  "recoverable-error": "Something went wrong",
  "terminal-error": "This page cannot be shown",
  ready: "Ready",
};

export function DefaultState({ state, error, retry }: { readonly state: RexDataState } & StateProps) {
  const failed = state === "recoverable-error" || state === "stale" || state === "offline";
  return (
    <div role={state === "loading" ? "status" : "alert"} data-rex-default-state={state}>
      <p>{STATE_TEXT[state]}</p>
      {error !== null ? <p>{error.message}</p> : null}
      {failed ? (
        <button type="button" onClick={retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function firstError(queries: readonly Query[]): Error | null {
  for (const query of queries) {
    const error: unknown = query.state.error;
    if (error instanceof Error) return error;
    if (error !== null && error !== undefined) return new Error(String(error));
  }
  return null;
}

export interface PageHostProps {
  readonly modules: PageModuleSet;
}

function useActiveResolution(modules: PageModuleSet): PageResolution {
  const resolution = useActivePage();
  if (resolution === null) throw new RexError("REX306", "rex: PageHost must render inside an active page route");
  if (resolution.page !== modules.page) {
    throw new RexError(
      "REX313",
      `rex: PageHost received modules for page "${modules.page.id}" while "${resolution.page.id}" is active`,
    );
  }
  return resolution;
}

const lazyPages = new WeakMap<LazyPageModuleSet, LazyExoticComponent<ComponentType>>();

function lazyPage(modules: LazyPageModuleSet): LazyExoticComponent<ComponentType> {
  let component = lazyPages.get(modules);
  if (component === undefined) {
    component = lazy(async () => {
      const loaded = await modules.load();
      const eager = definePageModules({
        page: modules.page,
        view: loaded.view as ComponentType,
        states: loaded.states as PageStatesModule<AnyPage>,
        regions: (loaded.regions ?? {}) as Readonly<Record<string, ComponentType>>,
        overlays: (loaded.overlays ?? {}) as Readonly<Record<string, ComponentType>>,
      });
      function LoadedPage() {
        return <EagerPageHost modules={eager} />;
      }
      LoadedPage.displayName = `RexPage(${modules.page.id})`;
      return { default: LoadedPage };
    });
    lazyPages.set(modules, component);
  }
  return component;
}

function PageLoading({ modules }: { readonly modules: LazyPageModuleSet }) {
  const resolution = useActiveResolution(modules);
  return (
    <main data-rex-page={modules.page.id} data-rex-page-loading="">
      <DefaultState state="loading" params={resolution.params} retry={() => {}} error={null} />
    </main>
  );
}

export function PageHost({ modules }: PageHostProps) {
  if (!isLazyPageModules(modules)) return <EagerPageHost modules={modules} />;
  const Loaded = lazyPage(modules);
  return (
    <Suspense fallback={<PageLoading modules={modules} />}>
      <Loaded />
    </Suspense>
  );
}

function EagerPageHost({ modules }: { readonly modules: EagerPageModuleSet }) {
  const resolution = useActiveResolution(modules);
  const declared = resolution.page;
  const validated = useMemo(() => definePageModules(modules), [modules]);
  const queryClient = useQueryClient();
  const loadable = resolution.policy.allowed && resolution.issues.length === 0;
  const loaderResults = usePageLoaderQueries(declared, resolution.params, loadable);
  const queries = usePageQueries(pageQueryScope(resolution));
  const loaderHashes = useMemo(
    () => new Set(pageLoaderQueryHashes(declared, resolution.params)),
    [declared, resolution.params],
  );
  const dataState = useDataState(
    [
      ...loaderResults,
      ...queries.filter((query) => !loaderHashes.has(query.queryHash)).map((query) => query.state),
    ],
    { policy: resolution.policy },
  );
  const invalid = resolution.policy.allowed && resolution.issues.length > 0;
  const state: RexDataState = invalid ? "terminal-error" : dataState;
  const error = invalid
    ? new Error(
        `invalid params: ${resolution.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`,
      )
    : firstError(queries);

  const retry = useCallback(() => {
    for (const query of queries) {
      void queryClient.refetchQueries({ queryKey: query.queryKey, exact: true, type: "all" });
    }
  }, [queries, queryClient]);

  const runtime = useMemo<PageRuntime>(
    () => ({ page: declared, params: resolution.params, state, resolution }),
    [declared, resolution, state],
  );

  let body: ReactNode;
  if (state === "ready") {
    const View = validated.view;
    body = <View />;
  } else {
    const exports = validated.states as Readonly<Record<string, unknown>>;
    const Export = declared.states.includes(state)
      ? (exports[STATE_EXPORT_NAMES[state]] as StateExportComponent | undefined)
      : undefined;
    body =
      Export === undefined ? (
        <DefaultState state={state} params={resolution.params} retry={retry} error={error} />
      ) : (
        <Export params={resolution.params} retry={retry} error={error} />
      );
  }

  return (
    <PageRuntimeContext.Provider value={runtime}>
      <PageStatesContext.Provider value={validated.states as Readonly<Record<string, unknown>>}>
        <main data-rex-page={declared.id}>{body}</main>
      </PageStatesContext.Provider>
    </PageRuntimeContext.Provider>
  );
}
