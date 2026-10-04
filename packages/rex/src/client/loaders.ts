import { ORPCError } from "@orpc/client";
import {
  hashKey,
  useQueries,
  useQuery,
  type DehydratedState,
  type Query,
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ActionOutput, AnyAction } from "../core/action.ts";
import { RexError, isRexError } from "../core/errors.ts";
import type { AnyPage, PageDeclaration, PageLoader, PageParamsSchema } from "../core/page.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { RexDataState } from "../core/states.ts";
import { formatIssues, validateStandard } from "../core/standard.ts";
import { isPlainObject } from "../core/entity.ts";
import { procedureOf, useRexClient, type RexClient } from "./context.ts";
import { useActivePage } from "./router.tsx";
import { STATIC_LOADER_DEFAULTS, isStaticHost } from "./static-host.ts";

export const LOADER_QUERY_SCOPE = "loader";

export type LoaderQueryKey = readonly [typeof LOADER_QUERY_SCOPE, string, string, string];

export type LoaderParams = Readonly<Record<string, unknown>>;

export type LoaderAction<S> = S extends AnyAction
  ? S
  : S extends { readonly action: infer A extends AnyAction }
    ? A
    : never;

export type LoaderOutput<S> = ActionOutput<LoaderAction<S>>;

export type PageLoad<Pg> =
  Pg extends PageDeclaration<
    string,
    PageParamsSchema,
    RexDataState,
    string,
    string,
    AnyAction,
    infer L
  >
    ? L
    : never;

export type LoaderName<Pg> = keyof PageLoad<Pg> & string;

export type LoaderResult<Pg, N extends LoaderName<Pg>> = UseQueryResult<
  LoaderOutput<PageLoad<Pg>[N]>,
  RexLoaderError
>;

export type LoaderResults<Pg> = { readonly [N in LoaderName<Pg>]: LoaderResult<Pg, N> };

export interface LoaderErrorJson {
  readonly name: "RexLoaderError";
  readonly page: string;
  readonly loader: string;
  readonly code: string;
  readonly status: number | null;
  readonly message: string;
}

export interface LoaderErrorInit {
  readonly page: string;
  readonly loader: string;
  readonly code: string;
  readonly status: number | null;
  readonly message: string;
}

export class RexLoaderError extends Error {
  readonly page: string;
  readonly loader: string;
  readonly code: string;
  readonly status: number | null;

  constructor(init: LoaderErrorInit) {
    super(init.message);
    this.name = "RexLoaderError";
    this.page = init.page;
    this.loader = init.loader;
    this.code = init.code;
    this.status = init.status;
  }

  toJSON(): LoaderErrorJson {
    return {
      name: "RexLoaderError",
      page: this.page,
      loader: this.loader,
      code: this.code,
      status: this.status,
      message: this.message,
    };
  }
}

export function loaderError(page: string, loader: string, error: unknown): RexLoaderError {
  if (error instanceof RexLoaderError) return error;
  if (error instanceof ORPCError) {
    return new RexLoaderError({
      page,
      loader,
      code: String(error.code),
      status: error.status,
      message: error.message,
    });
  }
  return new RexLoaderError({
    page,
    loader,
    code: isRexError(error) ? error.code : "ERROR",
    status: null,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function pageLoader(declared: AnyPage, name: string): PageLoader {
  const found = declared.loaders.find((loader) => loader.name === name);
  if (found === undefined) {
    throw new RexError("REX307", `rex: page "${declared.id}" declares no loader "${name}"`);
  }
  return found;
}

export function loaderInput(loader: PageLoader, params: LoaderParams): unknown {
  return loader.input === null ? params : loader.input(params);
}

export function loaderInputDigest(input: unknown): string {
  return hashKey([input === undefined ? null : input]);
}

export function loaderQueryKey(page: string, loader: string, input: unknown): LoaderQueryKey {
  return [LOADER_QUERY_SCOPE, page, loader, loaderInputDigest(input)];
}

export function pageLoaderQueryKey(
  declared: AnyPage,
  loader: PageLoader,
  params: LoaderParams,
): LoaderQueryKey {
  return loaderQueryKey(declared.id, loader.name, loaderInput(loader, params));
}

export function pageLoaderQueryHashes(declared: AnyPage, params: LoaderParams): readonly string[] {
  return declared.loaders.map((loader) => hashKey(pageLoaderQueryKey(declared, loader, params)));
}

export function isLoaderQueryKey(key: QueryKey): key is LoaderQueryKey {
  return (
    key.length === 4 &&
    key[0] === LOADER_QUERY_SCOPE &&
    typeof key[1] === "string" &&
    typeof key[2] === "string" &&
    typeof key[3] === "string"
  );
}

export function loaderInvalidatedBy(
  declared: AnyPage,
  loaderName: string,
  mutating: AnyAction,
): boolean {
  const loader = declared.loaders.find((entry) => entry.name === loaderName);
  if (loader === undefined) return false;
  return (
    mutating.invalidates.includes(loader.name) ||
    mutating.invalidates.includes(loader.action.id) ||
    loader.invalidatedBy.includes(mutating.id)
  );
}

export function invalidatesLoaderQuery(
  registry: RegistrySnapshot,
  key: QueryKey,
  mutating: AnyAction,
): boolean {
  if (!isLoaderQueryKey(key)) return false;
  const declared = registry.find("page", key[1]);
  return declared !== undefined && loaderInvalidatedBy(declared, key[2], mutating);
}

export function shouldDehydrateRexQuery(query: Query): boolean {
  if (query.state.status === "success") return true;
  return query.state.status === "error" && isLoaderQueryKey(query.queryKey);
}

const serverSeeded = new WeakMap<object, number>();

export interface SeededCandidate {
  readonly state: { readonly data: unknown; readonly dataUpdatedAt: number };
}

export function isServerSeeded(query: SeededCandidate): boolean {
  return query.state.data !== undefined && serverSeeded.get(query) === query.state.dataUpdatedAt;
}

function refetchUnlessServerSeeded(query: SeededCandidate): boolean {
  return !isServerSeeded(query);
}

export function reviveLoaderError(key: LoaderQueryKey, value: unknown): RexLoaderError {
  if (value instanceof RexLoaderError) return value;
  const shape = isPlainObject(value) ? value : {};
  return new RexLoaderError({
    page: typeof shape.page === "string" ? shape.page : key[1],
    loader: typeof shape.loader === "string" ? shape.loader : key[2],
    code: typeof shape.code === "string" ? shape.code : "ERROR",
    status: typeof shape.status === "number" ? shape.status : null,
    message: typeof shape.message === "string" ? shape.message : String(value),
  });
}

export function adoptServerLoaders(queryClient: QueryClient, state: DehydratedState): void {
  const cache = queryClient.getQueryCache();
  for (const dehydrated of state.queries) {
    if (!isLoaderQueryKey(dehydrated.queryKey)) continue;
    const query = cache.get(dehydrated.queryHash);
    if (query === undefined) continue;
    if (query.state.status === "error") {
      const error = reviveLoaderError(dehydrated.queryKey, query.state.error);
      query.setState({ ...query.state, error, fetchFailureReason: error });
    } else if (query.state.status === "success") {
      serverSeeded.set(query, query.state.dataUpdatedAt);
    }
  }
}

export interface LoaderQueryOptionsInput {
  readonly page: AnyPage;
  readonly loader: PageLoader;
  readonly params: LoaderParams;
  readonly client: RexClient;
  readonly enabled?: boolean;
  readonly consumer?: boolean;
}

export type LoaderQueryOptions = UseQueryOptions<unknown, RexLoaderError, unknown, LoaderQueryKey>;

export function loaderQueryOptions(source: LoaderQueryOptionsInput): LoaderQueryOptions {
  const { page: declared, loader, params, client } = source;
  const input = loaderInput(loader, params);
  const declaredAction = loader.action;
  const options: LoaderQueryOptions = {
    queryKey: loaderQueryKey(declared.id, loader.name, input),
    queryFn: async () => {
      try {
        const raw = await procedureOf(client, declaredAction.id)(input);
        const parsed = await validateStandard(declaredAction.output, raw);
        if (parsed.issues !== undefined) {
          throw new RexError(
            "REX309",
            `loader "${loader.name}" of page "${declared.id}": the server returned an invalid output: ${formatIssues(parsed.issues)}`,
          );
        }
        return parsed.value;
      } catch (error) {
        throw loaderError(declared.id, loader.name, error);
      }
    },
    retryOnMount: false,
    refetchOnMount: source.consumer === true ? false : refetchUnlessServerSeeded,
    enabled: source.enabled ?? true,
  };
  if (isStaticHost()) return { ...options, ...STATIC_LOADER_DEFAULTS };
  return declared.cache === null ? options : { ...options, staleTime: declared.cache.staleTime };
}

function useLoaderParams(declared: AnyPage, hook: string): LoaderParams {
  const active = useActivePage();
  if (active === null || active.page !== declared) {
    throw new RexError(
      "REX306",
      `rex: ${hook}(${declared.id}) must render inside the active page "${declared.id}"`,
    );
  }
  return active.params;
}

function useLoaderQueries(
  declared: AnyPage,
  params: LoaderParams,
  enabled: boolean,
  consumer: boolean,
): readonly UseQueryResult<unknown, RexLoaderError>[] {
  const client = useRexClient();
  return useQueries({
    queries: declared.loaders.map((loader) =>
      loaderQueryOptions({ page: declared, loader, params, client, enabled, consumer }),
    ),
  });
}

export function usePageLoaderQueries(
  declared: AnyPage,
  params: LoaderParams,
  enabled = true,
): readonly UseQueryResult<unknown, RexLoaderError>[] {
  return useLoaderQueries(declared, params, enabled, false);
}

export function useLoader<Pg extends AnyPage, N extends LoaderName<Pg>>(
  declared: Pg,
  name: N,
): LoaderResult<Pg, N> {
  const params = useLoaderParams(declared, "useLoader");
  const client = useRexClient();
  const loader = pageLoader(declared, name);
  return useQuery(
    loaderQueryOptions({ page: declared, loader, params, client, consumer: true }),
  ) as LoaderResult<
    Pg,
    N
  >;
}

export function useLoaders<Pg extends AnyPage>(declared: Pg): LoaderResults<Pg> {
  const params = useLoaderParams(declared, "useLoaders");
  const results = useLoaderQueries(declared, params, true, true);
  return Object.fromEntries(
    declared.loaders.map((loader, index) => [loader.name, results[index]]),
  ) as unknown as LoaderResults<Pg>;
}
