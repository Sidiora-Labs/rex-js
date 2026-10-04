import { useQueryClient, type Query } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import { regionAddress, regionName } from "../core/ids.ts";
import type { AnyPage, PageStatesModule } from "../core/page.ts";
import { titleFromId } from "../core/page.ts";
import {
  STATE_EXPORT_NAMES,
  requiredStateExports,
  type RexDataState,
  type StateProps,
} from "../core/states.ts";
import { useAct } from "./act.ts";
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
  if (runtime === null) throw new Error("rex: this component must render inside a PageHost");
  return runtime;
}

export interface ViewContext<P = PageParamsValue> {
  readonly params: P;
  readonly state: RexDataState;
}

export type ViewComponent = ComponentType & { readonly rexKind: "view" };

export function view<P = PageParamsValue>(render: (ctx: ViewContext<P>) => ReactNode): ViewComponent {
  if (typeof render !== "function") throw new TypeError("view: render must be a function");
  function RexView() {
    const runtime = usePageRuntime();
    return <>{render({ params: runtime.params as P, state: runtime.state })}</>;
  }
  return Object.assign(RexView, { rexKind: "view" as const });
}

export interface RegionContext<P = PageParamsValue> {
  readonly page: string;
  readonly region: string;
  readonly params: P;
  readonly state: RexDataState;
  readonly act: typeof useAct;
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
  if (!runtime.page.regions.includes(name)) {
    throw new Error(`rex: region "${name}" is not declared by page "${runtime.page.id}"`);
  }
  return (
    <section aria-label={titleFromId(name)} data-rex-region={regionAddress(runtime.page.id, name)}>
      {children}
    </section>
  );
}

export function region<P = PageParamsValue>(
  name: string,
  render: (ctx: RegionContext<P>) => ReactNode,
): RegionComponent {
  regionName(name);
  if (typeof render !== "function") throw new TypeError("region: render must be a function");
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
          act: useAct,
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

export interface PageModuleSet<Pg extends AnyPage = AnyPage> {
  readonly page: Pg;
  readonly view: ComponentType;
  readonly states: PageStatesModule<Pg>;
  readonly regions?: Readonly<Record<string, ComponentType>>;
  readonly overlays?: Readonly<Record<string, ComponentType>>;
}

export class RexPageModuleError extends Error {
  readonly page: string;

  constructor(page: string, problem: string) {
    super(`page "${page}" modules: ${problem}`);
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

export function definePageModules<Pg extends AnyPage>(modules: PageModuleSet<Pg>): PageModuleSet<Pg> {
  const declared = modules.page;
  if (declared === undefined || declared.kind !== "page") {
    throw new TypeError("definePageModules: page must be a page declaration");
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

export function usePageQueries(scope: string): readonly Query[] {
  const cache = useQueryClient().getQueryCache();
  const observed = () => new Set(cache.getAll().filter((query) => query.getObserversCount() > 0));
  const tracked = useRef<{ scope: string; queries: Set<Query> } | null>(null);
  if (tracked.current === null || tracked.current.scope !== scope) {
    tracked.current = { scope, queries: observed() };
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

export function PageHost({ modules }: PageHostProps) {
  const resolution = useActivePage();
  if (resolution === null) throw new Error("rex: PageHost must render inside an active page route");
  if (resolution.page !== modules.page) {
    throw new Error(
      `rex: PageHost received modules for page "${modules.page.id}" while "${resolution.page.id}" is active`,
    );
  }
  const declared = resolution.page;
  const validated = useMemo(() => definePageModules(modules), [modules]);
  const queryClient = useQueryClient();
  const scope = `${declared.id}:${JSON.stringify(resolution.params)}`;
  const queries = usePageQueries(scope);
  const dataState = useDataState(
    queries.map((query) => query.state),
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
      <main data-rex-page={declared.id}>{body}</main>
    </PageRuntimeContext.Provider>
  );
}
