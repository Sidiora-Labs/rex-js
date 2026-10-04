import type { AnyAction } from "./action.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { RexDeclarationOptionError, type RexErrorCode } from "./errors.ts";
import { isValidName, validateName } from "./ids.ts";
import { overlayDeclaration, type OverlayDeclaration } from "./overlay.ts";
import { always, isPredicate, type Predicate } from "./policy.ts";
import { toJsonSchema, z, type JsonSchema } from "./schema.ts";
import { REX_DATA_STATES, isRexDataState, type RexDataState, type StatesModule } from "./states.ts";

declare module "./registry.ts" {
  interface RegistryKinds {
    page: AnyPage;
  }
}

export type PageDraft = "route" | "session" | "none";

export const PAGE_DRAFTS: readonly PageDraft[] = ["route", "session", "none"];

export const PAGE_RENDER_MODES = ["ssr", "csr", "ssg", "static"] as const;

export type PageRender = (typeof PAGE_RENDER_MODES)[number];

export const PAGE_TRANSITIONS = ["view", "none"] as const;

export type PageTransition = (typeof PAGE_TRANSITIONS)[number];

export const CHROME_COMPONENT_NAMES = ["Button", "Sheet", "PaletteItem", "Outcome"] as const;

export type ChromeComponentName = (typeof CHROME_COMPONENT_NAMES)[number];

export type PageChromeComponents = Readonly<Partial<Record<ChromeComponentName, unknown>>>;

export interface PageChromeConfig {
  readonly header?: boolean;
  readonly nav?: boolean;
  readonly back?: string | null;
  readonly title?: string;
  readonly components?: PageChromeComponents;
}

export interface PageChrome {
  readonly header: boolean;
  readonly nav: boolean;
  readonly back: string | null;
  readonly title: string;
  readonly components?: PageChromeComponents;
}

export interface PageLoaderInput<Act extends AnyAction = AnyAction> {
  readonly action: Act;
  input(params: Readonly<Record<string, unknown>>): unknown;
}

export type PageLoaderSpec = AnyAction | PageLoaderInput;

export type PageLoadMap = Readonly<Record<string, PageLoaderSpec>>;

export interface PageLoader {
  readonly name: string;
  readonly action: AnyAction;
  readonly input: ((params: Readonly<Record<string, unknown>>) => unknown) | null;
}

export interface PageCacheConfig {
  readonly staleTime: number;
}

export type PagePaths<P extends PageParamsSchema = PageParamsSchema> = () =>
  | readonly z.input<P>[]
  | Promise<readonly z.input<P>[]>;

export const LOADER_NAME = /^[a-z][a-zA-Z0-9]*$/;

export type RouteSegment =
  | { readonly kind: "static"; readonly value: string }
  | { readonly kind: "param"; readonly name: string };

export interface ParsedRoute {
  readonly route: string;
  readonly segments: readonly RouteSegment[];
  readonly params: readonly string[];
}

const STATIC_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;
const PARAM_SEGMENT = /^:([a-z][a-zA-Z0-9]*)$/;

export function parseRoute(route: string): ParsedRoute {
  if (typeof route !== "string" || !route.startsWith("/")) {
    throw new Error("route must be a string starting with /");
  }
  if (route === "/")
    return Object.freeze({ route, segments: Object.freeze([]), params: Object.freeze([]) });
  if (route.endsWith("/")) throw new Error("route must not end with /");
  const segments: RouteSegment[] = [];
  const params: string[] = [];
  for (const part of route.slice(1).split("/")) {
    const param = PARAM_SEGMENT.exec(part);
    if (param) {
      const name = param[1] as string;
      if (params.includes(name)) throw new Error(`route param ":${name}" is repeated`);
      params.push(name);
      segments.push(Object.freeze({ kind: "param", name }));
    } else if (STATIC_SEGMENT.test(part)) {
      segments.push(Object.freeze({ kind: "static", value: part }));
    } else {
      throw new Error(
        `route segment "${part}" must be lowercase letters, digits, dot, dash and underscore, or :camelCaseParam`,
      );
    }
  }
  return Object.freeze({ route, segments: Object.freeze(segments), params: Object.freeze(params) });
}

export type PageParamsSchema = z.ZodObject<z.ZodRawShape>;

export interface PageConfig<
  P extends PageParamsSchema,
  S extends readonly RexDataState[],
  R extends string,
  O extends string,
  A extends AnyAction,
  L extends PageLoadMap = PageLoadMap,
> {
  readonly route: string;
  readonly params?: P;
  readonly render?: PageRender;
  readonly revalidate?: number;
  readonly paths?: PagePaths<P>;
  readonly load?: L;
  readonly cache?: PageCacheConfig;
  readonly transition?: PageTransition;
  readonly policy?: Predicate;
  readonly recovery?: string;
  readonly draft?: PageDraft;
  readonly actions?: readonly A[];
  readonly chrome?: PageChromeConfig;
  readonly regions?: readonly R[];
  readonly overlays?: readonly OverlayDeclaration<O>[];
  readonly states?: S;
}

export interface PageDeclaration<
  N extends string = string,
  P extends PageParamsSchema = PageParamsSchema,
  S extends RexDataState = RexDataState,
  R extends string = string,
  O extends string = string,
  A extends AnyAction = AnyAction,
  L extends PageLoadMap = PageLoadMap,
> {
  readonly kind: "page";
  readonly id: N;
  readonly name: N;
  readonly route: string;
  readonly routeParams: readonly string[];
  readonly params: P;
  readonly paramsJsonSchema: JsonSchema;
  readonly policy: Predicate;
  readonly recovery: string | null;
  readonly draft: PageDraft;
  readonly actions: readonly A[];
  readonly chrome: PageChrome;
  readonly regions: readonly R[];
  readonly overlays: readonly OverlayDeclaration<O>[];
  readonly states: readonly S[];
  readonly render: PageRender | null;
  readonly revalidate: number | null;
  readonly paths: PagePaths<P> | null;
  readonly load: L;
  readonly loaders: readonly PageLoader[];
  readonly cache: PageCacheConfig | null;
  readonly transition: PageTransition;
}

export type AnyPage = PageDeclaration<
  string,
  PageParamsSchema,
  RexDataState,
  string,
  string,
  AnyAction,
  PageLoadMap
>;

export type PageParams<Pg> =
  Pg extends PageDeclaration<string, infer P, RexDataState, string, string, AnyAction>
    ? z.output<P>
    : never;

export type PageParamsInput<Pg> =
  Pg extends PageDeclaration<string, infer P, RexDataState, string, string, AnyAction>
    ? z.input<P>
    : never;

export type PageStates<Pg> =
  Pg extends PageDeclaration<string, PageParamsSchema, infer S, string, string, AnyAction>
    ? S
    : never;

export type PageStatesModule<Pg> = StatesModule<PageStates<Pg>, PageParams<Pg>>;

export function titleFromId(id: string): string {
  const words = id.split(/[.-]/).filter((word) => word.length > 0);
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const PAGE_KEYS = new Set([
  "route",
  "params",
  "policy",
  "recovery",
  "draft",
  "actions",
  "chrome",
  "regions",
  "overlays",
  "states",
  "render",
  "revalidate",
  "paths",
  "load",
  "cache",
  "transition",
]);
const CHROME_KEYS = new Set(["header", "nav", "back", "title", "components"]);
const LOADER_INPUT_KEYS = new Set(["action", "input"]);

function isActionDeclaration(value: unknown): value is AnyAction {
  return (
    typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "action"
  );
}

function isComponentLike(value: unknown): boolean {
  if (typeof value === "function") return true;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $$typeof?: unknown }).$$typeof === "symbol"
  );
}

export function page<
  const N extends string,
  P extends PageParamsSchema = z.ZodObject<{}>,
  const S extends readonly RexDataState[] = typeof REX_DATA_STATES,
  const R extends string = never,
  const O extends string = never,
  const A extends AnyAction = never,
  const L extends PageLoadMap = {},
>(
  name: N,
  config: PageConfig<P, S, R, O, A, L>,
): PageDeclaration<N, P, S[number], R, O, A, L> {
  const id = declarationName("page", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("page", id, field, problem);
  };
  const reject = (code: RexErrorCode, field: string, problem: string): never => {
    throw new RexDeclarationOptionError(code, { declaration: "page", id, field, problem });
  };

  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (!PAGE_KEYS.has(property)) fail(property, "is not part of the page declaration");
  }

  let parsedRoute: ParsedRoute | undefined;
  try {
    parsedRoute = parseRoute(config.route);
  } catch (error) {
    fail("route", (error as Error).message);
  }
  const route = parsedRoute as ParsedRoute;

  const params = (config.params ?? z.object({})) as P;
  if (!(params instanceof z.ZodObject)) fail("params", "must be a zod object schema");
  const shape = params.shape as Record<string, z.ZodType>;
  for (const routeParam of route.params) {
    const paramSchema = shape[routeParam];
    if (paramSchema === undefined) {
      fail("params", `must declare the route param "${routeParam}"`);
    } else if (paramSchema.safeParse(undefined).success) {
      fail(`params.${routeParam}`, "is a route param and must be required");
    }
  }
  let paramsJsonSchema: JsonSchema = {};
  try {
    paramsJsonSchema = toJsonSchema(params, "input");
  } catch (error) {
    fail("params", `cannot be represented as JSON Schema: ${(error as Error).message}`);
  }

  const policy = config.policy ?? always();
  if (!isPredicate(policy)) fail("policy", "must be a policy predicate");

  let recovery: string | null = null;
  if (config.recovery !== undefined) {
    if (!isValidName(config.recovery)) fail("recovery", "must name a page id");
    if (config.recovery === id) fail("recovery", "must name a different page");
    recovery = config.recovery;
  }

  const draft = config.draft ?? "none";
  if (!PAGE_DRAFTS.includes(draft)) fail("draft", `must be one of ${PAGE_DRAFTS.join(", ")}`);

  const actions = config.actions ?? [];
  if (!Array.isArray(actions)) fail("actions", "must be a list of action declarations");
  const actionIds = new Set<string>();
  for (const [index, declared] of actions.entries()) {
    if (
      typeof declared !== "object" ||
      declared === null ||
      (declared as { kind?: unknown }).kind !== "action"
    ) {
      fail(`actions.${index}`, "must be an action declaration");
    }
    if (actionIds.has(declared.id)) fail(`actions.${index}`, `repeats action "${declared.id}"`);
    actionIds.add(declared.id);
  }

  const chromeConfig: PageChromeConfig = config.chrome ?? {};
  if (!isPlainObject(chromeConfig as unknown)) fail("chrome", "must be an object");
  for (const property of Object.keys(chromeConfig)) {
    if (!CHROME_KEYS.has(property)) fail(`chrome.${property}`, "is not part of page chrome");
  }
  if (chromeConfig.header !== undefined && typeof chromeConfig.header !== "boolean") {
    fail("chrome.header", "must be a boolean");
  }
  if (chromeConfig.nav !== undefined && typeof chromeConfig.nav !== "boolean") {
    fail("chrome.nav", "must be a boolean");
  }
  const back = chromeConfig.back ?? null;
  if (back !== null && !isValidName(back)) fail("chrome.back", "must name a page id or be null");
  if (back === id) fail("chrome.back", "must name a different page");
  if (
    chromeConfig.title !== undefined &&
    (typeof chromeConfig.title !== "string" || chromeConfig.title.trim() === "")
  ) {
    fail("chrome.title", "must be a non-empty string");
  }
  let components: PageChromeComponents | undefined;
  if (chromeConfig.components !== undefined) {
    if (!isPlainObject(chromeConfig.components as unknown)) {
      reject("REX206", "chrome.components", "must map shell component names to components");
    }
    const entries: [string, unknown][] = [];
    for (const [componentName, component] of Object.entries(
      chromeConfig.components as Record<string, unknown>,
    )) {
      if (!(CHROME_COMPONENT_NAMES as readonly string[]).includes(componentName)) {
        reject(
          "REX206",
          `chrome.components.${componentName}`,
          `is not one of ${CHROME_COMPONENT_NAMES.join(", ")}`,
        );
      }
      if (!isComponentLike(component)) {
        reject("REX206", `chrome.components.${componentName}`, "must be a component");
      }
      entries.push([componentName, component]);
    }
    components = Object.freeze(Object.fromEntries(entries)) as PageChromeComponents;
  }
  const chromeBase = {
    header: chromeConfig.header ?? true,
    nav: chromeConfig.nav ?? true,
    back,
    title: chromeConfig.title ?? titleFromId(id),
  };
  const chrome: PageChrome = Object.freeze(
    components === undefined ? chromeBase : { ...chromeBase, components },
  );

  const regions = config.regions ?? [];
  if (!Array.isArray(regions)) fail("regions", "must be a list of region names");
  const regionNames = new Set<string>();
  for (const [index, region] of regions.entries()) {
    try {
      validateName(region, "region name");
    } catch (error) {
      fail(`regions.${index}`, (error as Error).message);
    }
    if (regionNames.has(region)) fail(`regions.${index}`, `repeats region "${region}"`);
    regionNames.add(region);
  }

  const overlayInputs: readonly OverlayDeclaration<O>[] = config.overlays ?? [];
  if (!Array.isArray(overlayInputs)) fail("overlays", "must be a list of overlay declarations");
  const overlayIds = new Set<string>();
  const overlays = overlayInputs.map((input, index): OverlayDeclaration<O> => {
    const declared = overlayDeclaration<O>(input, id);
    if (overlayIds.has(declared.id)) fail(`overlays.${index}`, `repeats overlay "${declared.id}"`);
    overlayIds.add(declared.id);
    return declared;
  });

  const states = (config.states ?? REX_DATA_STATES) as readonly RexDataState[];
  if (!Array.isArray(states)) fail("states", "must be a list of data states");
  const stateSet = new Set<RexDataState>();
  for (const [index, state] of states.entries()) {
    if (!isRexDataState(state)) {
      fail(`states.${index}`, `"${String(state)}" is not one of ${REX_DATA_STATES.join(", ")}`);
    }
    if (stateSet.has(state)) fail(`states.${index}`, `repeats state "${state}"`);
    stateSet.add(state);
  }
  if (!stateSet.has("ready")) fail("states", 'must include "ready"');
  const orderedStates = REX_DATA_STATES.filter((state) => stateSet.has(state));

  let render: PageRender | null = null;
  if (config.render !== undefined) {
    if (!(PAGE_RENDER_MODES as readonly string[]).includes(config.render)) {
      reject("REX200", "render", `must be one of ${PAGE_RENDER_MODES.join(", ")}`);
    }
    render = config.render;
  }

  let revalidate: number | null = null;
  if (config.revalidate !== undefined) {
    if (render !== "ssg") reject("REX201", "revalidate", 'is only allowed with render "ssg"');
    if (!Number.isInteger(config.revalidate) || config.revalidate <= 0) {
      reject("REX201", "revalidate", "must be a positive whole number of seconds");
    }
    revalidate = config.revalidate;
  }

  let paths: PagePaths<P> | null = null;
  if (config.paths !== undefined) {
    if (typeof config.paths !== "function") reject("REX202", "paths", "must be a function");
    if (render !== "ssg" && render !== "static") {
      reject("REX202", "paths", 'is only allowed with render "ssg" or "static"');
    }
    if (route.params.length === 0) {
      reject("REX202", "paths", "is only allowed on a route with params");
    }
    paths = config.paths;
  }

  const loadConfig = (config.load ?? {}) as L;
  if (!isPlainObject(loadConfig as unknown)) {
    reject("REX203", "load", "must map loader names to read actions");
  }
  const loaders: PageLoader[] = [];
  for (const [loaderName, spec] of Object.entries(loadConfig as PageLoadMap)) {
    const field = `load.${loaderName}`;
    if (!LOADER_NAME.test(loaderName)) {
      reject("REX203", field, "must be a camelCase loader name");
    }
    let loaderAction: unknown = spec;
    let loaderInput: PageLoader["input"] = null;
    if (!isActionDeclaration(spec)) {
      if (!isPlainObject(spec as unknown)) {
        reject("REX203", field, "must be a read action or { action, input }");
      }
      for (const property of Object.keys(spec)) {
        if (!LOADER_INPUT_KEYS.has(property)) {
          reject("REX203", `${field}.${property}`, "is not one of action, input");
        }
      }
      if (typeof spec.input !== "function") {
        reject("REX203", `${field}.input`, "must be a function from the page params to the input");
      }
      loaderAction = spec.action;
      const mapper = spec.input.bind(spec);
      loaderInput = (params) => mapper(params);
    }
    if (!isActionDeclaration(loaderAction)) {
      reject("REX203", field, "must reference an action declaration");
    }
    const declared = loaderAction as AnyAction;
    if (declared.effect !== "read") {
      reject("REX203", field, `references action "${declared.id}" whose effect is not read`);
    }
    loaders.push(Object.freeze({ name: loaderName, action: declared, input: loaderInput }));
  }

  let cache: PageCacheConfig | null = null;
  if (config.cache !== undefined) {
    if (!isPlainObject(config.cache as unknown)) reject("REX204", "cache", "must be an object");
    for (const property of Object.keys(config.cache)) {
      if (property !== "staleTime") reject("REX204", `cache.${property}`, "is not staleTime");
    }
    if (!Number.isInteger(config.cache.staleTime) || config.cache.staleTime < 0) {
      reject("REX204", "cache.staleTime", "must be a whole number of milliseconds of zero or more");
    }
    cache = Object.freeze({ staleTime: config.cache.staleTime });
  }

  const transition = config.transition ?? "none";
  if (!(PAGE_TRANSITIONS as readonly string[]).includes(transition)) {
    reject("REX205", "transition", `must be one of ${PAGE_TRANSITIONS.join(", ")}`);
  }

  return Object.freeze({
    kind: "page",
    id,
    name: id,
    route: route.route,
    routeParams: route.params,
    params,
    paramsJsonSchema: Object.freeze(paramsJsonSchema),
    policy,
    recovery,
    draft,
    actions: Object.freeze([...actions]),
    chrome,
    regions: Object.freeze([...regions]),
    overlays: Object.freeze(overlays),
    states: Object.freeze(orderedStates) as readonly S[number][],
    render,
    revalidate,
    paths,
    load: Object.freeze({ ...loadConfig }) as L,
    loaders: Object.freeze(loaders),
    cache,
    transition,
  });
}
