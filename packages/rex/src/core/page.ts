import type { AnyAction } from "./action.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { RexDeclarationOptionError, RexError, errorDetail, type RexErrorCode } from "./errors.ts";
import { isValidName, validateName } from "./ids.ts";
import { overlayDeclaration, type OverlayDeclaration } from "./overlay.ts";
import { always, isPredicate, type Predicate } from "./policy.ts";
import { acceptsSync, objectSchema, objectShape, schemaType } from "./schema.ts";
import {
  isStandardSchema,
  isZodSchema,
  type StandardInferInput,
  type StandardInferOutput,
  type StandardSchemaV1,
} from "./standard.ts";
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

export interface PageChromeConfig {
  readonly header?: boolean;
  readonly nav?: boolean;
  readonly back?: string | null;
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly frame?: string;
  readonly order?: number;
  readonly icon?: string;
}

export interface PageChrome {
  readonly header: boolean;
  readonly nav: boolean;
  readonly back: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly image: string | null;
  readonly frame: string | null;
  readonly order: number | null;
  readonly icon: string | null;
}

export const ISLAND_MODES = ["load", "idle", "visible", "never"] as const;

export type IslandMode = (typeof ISLAND_MODES)[number];

export type PageIslands<R extends string = string> = Readonly<Partial<Record<R, IslandMode>>>;

export const PAGE_PREFETCH = ["hover", "viewport", "none"] as const;

export type PagePrefetch = (typeof PAGE_PREFETCH)[number];

export const PAGE_FALLBACKS = ["render", "not-found"] as const;

export type PageFallback = (typeof PAGE_FALLBACKS)[number];

export const NOT_FOUND_PAGE_ID = "not-found";

export const NOT_FOUND_ROUTE = "/404";

export const FRAME_NAME = /^[a-z][a-zA-Z0-9]*$/;

export const ICON_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const CHROME_PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

export const CHROME_MESSAGE_PREFIX = "msg:";

function chromePlaceholderValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join("/");
  }
  return null;
}

export function chromePlaceholders(template: string): readonly string[] {
  if (template.startsWith(CHROME_MESSAGE_PREFIX)) return [];
  return [
    ...new Set([...template.matchAll(CHROME_PLACEHOLDER)].map((match) => match[1] as string)),
  ];
}

export function resolveChromeText(
  template: string,
  params: Readonly<Record<string, unknown>>,
): string {
  if (template.startsWith(CHROME_MESSAGE_PREFIX)) return template;
  return template.replace(CHROME_PLACEHOLDER, (placeholder, name: string) => {
    const value = Object.hasOwn(params, name) ? chromePlaceholderValue(params[name]) : null;
    return value ?? placeholder;
  });
}

export interface PageLoaderInput<Act extends AnyAction = AnyAction> {
  readonly action: Act;
  input?(params: Readonly<Record<string, unknown>>): unknown;
  readonly invalidatedBy?: readonly string[];
}

export type PageLoaderSpec = AnyAction | PageLoaderInput;

export type PageLoadMap = Readonly<Record<string, PageLoaderSpec>>;

export interface PageLoader {
  readonly name: string;
  readonly action: AnyAction;
  readonly input: ((params: Readonly<Record<string, unknown>>) => unknown) | null;
  readonly invalidatedBy: readonly string[];
}

export interface PageCacheConfig {
  readonly staleTime: number;
}

export type PagePaths<Params = Readonly<Record<string, unknown>>> = () =>
  readonly Params[] | Promise<readonly Params[]>;

export interface PagePathsAction<Act extends AnyAction = AnyAction, Params = unknown> {
  readonly action: Act;
  map(output: ActionOutputOf<Act>): readonly Params[];
}

type ActionOutputOf<Act extends AnyAction> = StandardInferOutput<Act["output"]>;

export type PagePathsConfig<Params = Readonly<Record<string, unknown>>> =
  PagePaths<Params> | PagePathsAction<AnyAction, Params>;

export const LOADER_NAME = /^[a-z][a-zA-Z0-9]*$/;

export type RouteSegment =
  | { readonly kind: "static"; readonly value: string }
  | { readonly kind: "param"; readonly name: string }
  | { readonly kind: "rest"; readonly name: string; readonly optional: boolean };

export interface ParsedRoute {
  readonly route: string;
  readonly segments: readonly RouteSegment[];
  readonly params: readonly string[];
  readonly rest: string | null;
}

const STATIC_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;
const PARAM_SEGMENT = /^:([a-z][a-zA-Z0-9]*)$/;
const REST_SEGMENT = /^:([a-z][a-zA-Z0-9]*)\*(\?)?$/;

export function parseRoute(route: string): ParsedRoute {
  if (typeof route !== "string" || !route.startsWith("/")) {
    throw new RexError("REX220", "route must be a string starting with /");
  }
  if (route === "/") {
    return Object.freeze({
      route,
      segments: Object.freeze([]),
      params: Object.freeze([]),
      rest: null,
    });
  }
  if (route.endsWith("/")) throw new RexError("REX220", "route must not end with /");
  const segments: RouteSegment[] = [];
  const params: string[] = [];
  let rest: string | null = null;
  const parts = route.slice(1).split("/");
  for (const [index, part] of parts.entries()) {
    const param = PARAM_SEGMENT.exec(part);
    const restParam = REST_SEGMENT.exec(part);
    if (param || restParam) {
      const name = ((param ?? restParam) as RegExpExecArray)[1] as string;
      if (params.includes(name)) {
        throw new RexError("REX220", `route param ":${name}" is repeated`);
      }
      params.push(name);
      if (restParam) {
        if (index !== parts.length - 1) {
          throw new RexError(
            "REX220",
            `rest segment ":${name}*" must be the last segment of the route`,
          );
        }
        rest = name;
        segments.push(Object.freeze({ kind: "rest", name, optional: restParam[2] === "?" }));
      } else {
        segments.push(Object.freeze({ kind: "param", name }));
      }
    } else if (STATIC_SEGMENT.test(part)) {
      segments.push(Object.freeze({ kind: "static", value: part }));
    } else {
      throw new RexError(
        "REX220",
        `route segment "${part}" must be lowercase letters, digits, dot, dash and underscore, :camelCaseParam, or a last :rest* or :rest*? segment`,
      );
    }
  }
  return Object.freeze({
    route,
    segments: Object.freeze(segments),
    params: Object.freeze(params),
    rest,
  });
}

export type PageParamsSchema = StandardSchemaV1;

export type EmptyPageParams = StandardSchemaV1<{}, {}>;

export interface PageConfig<
  P extends StandardSchemaV1,
  S extends readonly RexDataState[],
  R extends string,
  O extends string,
  A extends AnyAction,
  L extends PageLoadMap = PageLoadMap,
  PA extends AnyAction = AnyAction,
> {
  readonly route: string;
  readonly params?: P;
  readonly render?: PageRender;
  readonly revalidate?: number;
  readonly paths?: PagePaths<StandardInferInput<P>> | PagePathsAction<PA, StandardInferInput<P>>;
  readonly fallback?: PageFallback;
  readonly load?: L;
  readonly cache?: PageCacheConfig;
  readonly transition?: PageTransition;
  readonly prefetch?: PagePrefetch;
  readonly policy?: Predicate;
  readonly recovery?: string;
  readonly draft?: PageDraft;
  readonly actions?: readonly A[];
  readonly chrome?: PageChromeConfig;
  readonly regions?: readonly R[];
  readonly islands?: PageIslands<NoInfer<R>>;
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
  readonly paths: PagePaths<StandardInferInput<P>> | null;
  readonly pathsAction: PagePathsAction<AnyAction, StandardInferInput<P>> | null;
  readonly fallback: PageFallback | null;
  readonly load: L;
  readonly loaders: readonly PageLoader[];
  readonly cache: PageCacheConfig | null;
  readonly transition: PageTransition;
  readonly prefetch: PagePrefetch | null;
  readonly islands: PageIslands<R>;
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
    ? StandardInferOutput<P>
    : never;

export type PageParamsInput<Pg> =
  Pg extends PageDeclaration<string, infer P, RexDataState, string, string, AnyAction>
    ? StandardInferInput<P>
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
  "fallback",
  "load",
  "cache",
  "transition",
  "prefetch",
  "islands",
]);
const CHROME_KEYS = new Set([
  "header",
  "nav",
  "back",
  "title",
  "description",
  "image",
  "frame",
  "order",
  "icon",
]);
const PATHS_ACTION_KEYS = new Set(["action", "map"]);
const LOADER_INPUT_KEYS = new Set(["action", "input", "invalidatedBy"]);

function loaderInvalidatedByList(
  value: unknown,
  field: string,
  reject: (code: RexErrorCode, field: string, problem: string) => never,
): readonly string[] {
  if (!Array.isArray(value)) return reject("REX203", field, "must be a list of action ids");
  const ids = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || !isValidName(entry)) {
      reject("REX203", `${field}.${index}`, "must be an action id");
    }
    if (ids.has(entry)) reject("REX203", `${field}.${index}`, `repeats action "${entry}"`);
    ids.add(entry);
  }
  return Object.freeze([...ids]);
}

function isActionDeclaration(value: unknown): value is AnyAction {
  return (
    typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "action"
  );
}

const EMPTY_PARAMS: EmptyPageParams = objectSchema<{}, {}, {}>({});

function restParamProblem(paramSchema: StandardSchemaV1, optional: boolean): string | null {
  if (!acceptsSync(paramSchema, ["a", "b"]) || acceptsSync(paramSchema, "a")) {
    return "is a rest route param and must be an array of strings";
  }
  if (optional) {
    return acceptsSync(paramSchema, [])
      ? null
      : "is an optional rest route param (:name*?) and must accept []";
  }
  return acceptsSync(paramSchema, undefined) ? "is a rest route param and must be required" : null;
}

function pageParamsSchema(
  value: unknown,
  route: ParsedRoute,
  fail: (field: string, problem: string) => never,
): PageParamsSchema {
  const routeParams = route.params;
  if (value === undefined) {
    if (routeParams.length > 0) fail("params", `must declare the route param "${routeParams[0]}"`);
    return EMPTY_PARAMS;
  }
  if (!isStandardSchema(value)) {
    return fail("params", "must be a Standard Schema object such as a zod object");
  }
  if (!isZodSchema(value)) return value;
  const shape = objectShape(value);
  if (shape === undefined || schemaType(value) !== "object") {
    return fail("params", "must be an object schema");
  }
  for (const segment of route.segments) {
    if (segment.kind === "static") continue;
    const paramSchema = shape[segment.name];
    if (paramSchema === undefined) {
      fail("params", `must declare the route param "${segment.name}"`);
    } else if (!isStandardSchema(paramSchema)) {
      fail(`params.${segment.name}`, "must be a Standard Schema");
    } else if (segment.kind === "rest") {
      const problem = restParamProblem(paramSchema, segment.optional);
      if (problem !== null) fail(`params.${segment.name}`, problem);
    } else if (acceptsSync(paramSchema, undefined)) {
      fail(`params.${segment.name}`, "is a route param and must be required");
    }
  }
  return value;
}

function paramNames(params: PageParamsSchema, route: ParsedRoute): ReadonlySet<string> {
  const names = new Set(route.params);
  const shape = isZodSchema(params) ? objectShape(params) : undefined;
  for (const name of Object.keys(shape ?? {})) names.add(name);
  return names;
}

export function page<
  const N extends string,
  P extends StandardSchemaV1 = EmptyPageParams,
  const S extends readonly RexDataState[] = typeof REX_DATA_STATES,
  const R extends string = never,
  const O extends string = never,
  const A extends AnyAction = never,
  const L extends PageLoadMap = {},
  const PA extends AnyAction = AnyAction,
>(name: N, config: PageConfig<P, S, R, O, A, L, PA>): PageDeclaration<N, P, S[number], R, O, A, L> {
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
    fail("route", errorDetail(error));
  }
  const route = parsedRoute as ParsedRoute;

  const params = pageParamsSchema(config.params, route, fail) as P;

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
  const chromeText = (field: "description" | "image" | "icon", value: unknown): string | null => {
    if (value === undefined) return null;
    if (typeof value !== "string" || value.trim() === "") {
      return reject("REX225", `chrome.${field}`, "must be a non-empty string");
    }
    return value;
  };
  const description = chromeText("description", chromeConfig.description);
  const image = chromeText("image", chromeConfig.image);
  if (image !== null && !isImageReference(image)) {
    reject("REX225", "chrome.image", "must be a path starting with / or an http(s) URL");
  }
  let frame: string | null = null;
  if (chromeConfig.frame !== undefined) {
    if (typeof chromeConfig.frame !== "string" || !FRAME_NAME.test(chromeConfig.frame)) {
      reject("REX225", "chrome.frame", "must name a camelCase export of the frames map");
    }
    frame = chromeConfig.frame;
  }
  let order: number | null = null;
  if (chromeConfig.order !== undefined) {
    if (!Number.isInteger(chromeConfig.order)) {
      reject("REX225", "chrome.order", "must be a whole number");
    }
    order = chromeConfig.order;
  }
  const icon = chromeText("icon", chromeConfig.icon);
  if (icon !== null && !ICON_NAME.test(icon)) {
    reject("REX225", "chrome.icon", "must be a kebab-case icon name such as wallet or arrow-up");
  }
  const title = chromeConfig.title ?? titleFromId(id);
  const declaredParams = paramNames(params, route);
  for (const [field, template] of [
    ["title", title],
    ["description", description],
  ] as const) {
    if (template === null) continue;
    for (const name of chromePlaceholders(template)) {
      if (!declaredParams.has(name)) {
        reject("REX225", `chrome.${field}`, `placeholder {${name}} names no declared param`);
      }
    }
  }
  const chrome: PageChrome = Object.freeze({
    header: chromeConfig.header ?? true,
    nav: chromeConfig.nav ?? true,
    back,
    title,
    description,
    image,
    frame,
    order,
    icon,
  });

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

  let paths: PagePaths<StandardInferInput<P>> | null = null;
  let pathsAction: PagePathsAction<AnyAction, StandardInferInput<P>> | null = null;
  if (config.paths !== undefined) {
    const declaredPaths: unknown = config.paths;
    if (typeof declaredPaths === "function") {
      paths = declaredPaths as PagePaths<StandardInferInput<P>>;
    } else if (isPlainObject(declaredPaths)) {
      for (const property of Object.keys(declaredPaths)) {
        if (!PATHS_ACTION_KEYS.has(property)) {
          reject("REX202", `paths.${property}`, "is not one of action, map");
        }
      }
      if (!isActionDeclaration(declaredPaths.action)) {
        reject("REX202", "paths.action", "must be a read action declaration");
      }
      const pathsSource = declaredPaths.action as AnyAction;
      if (pathsSource.effect !== "read") {
        reject(
          "REX202",
          "paths.action",
          `references action "${pathsSource.id}" whose effect is not read`,
        );
      }
      if (typeof declaredPaths.map !== "function") {
        reject("REX202", "paths.map", "must be a function from the action output to params");
      }
      const map = declaredPaths.map as (output: unknown) => readonly StandardInferInput<P>[];
      pathsAction = Object.freeze({
        action: pathsSource,
        map: (output: unknown) => map(output),
      });
    } else {
      reject("REX202", "paths", "must be a function or { action, map }");
    }
    if (render !== "ssg" && render !== "static") {
      reject("REX202", "paths", 'is only allowed with render "ssg" or "static"');
    }
    if (route.params.length === 0) {
      reject("REX202", "paths", "is only allowed on a route with params");
    }
  }

  let fallback: PageFallback | null = null;
  if (config.fallback !== undefined) {
    if (!(PAGE_FALLBACKS as readonly string[]).includes(config.fallback)) {
      reject("REX230", "fallback", `must be one of ${PAGE_FALLBACKS.join(", ")}`);
    }
    if (config.paths === undefined) {
      reject("REX230", "fallback", "is only allowed on a page with paths");
    }
    fallback = config.fallback;
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
    let invalidatedBy: readonly string[] = Object.freeze([]);
    if (!isActionDeclaration(spec)) {
      if (!isPlainObject(spec as unknown)) {
        reject("REX203", field, "must be a read action or { action, input, invalidatedBy }");
      }
      for (const property of Object.keys(spec)) {
        if (!LOADER_INPUT_KEYS.has(property)) {
          reject("REX203", `${field}.${property}`, "is not one of action, input, invalidatedBy");
        }
      }
      if (spec.invalidatedBy !== undefined) {
        invalidatedBy = loaderInvalidatedByList(
          spec.invalidatedBy,
          `${field}.invalidatedBy`,
          reject,
        );
      }
      if (spec.input !== undefined || spec.invalidatedBy === undefined) {
        const mapInput: unknown = spec.input;
        if (typeof mapInput !== "function") {
          return reject(
            "REX203",
            `${field}.input`,
            "must be a function from the page params to the input",
          );
        }
        const mapper = mapInput.bind(spec) as NonNullable<PageLoader["input"]>;
        loaderInput = (params) => mapper(params);
      }
      loaderAction = spec.action;
    }
    if (!isActionDeclaration(loaderAction)) {
      reject("REX203", field, "must reference an action declaration");
    }
    const declared = loaderAction as AnyAction;
    if (declared.effect !== "read") {
      reject("REX203", field, `references action "${declared.id}" whose effect is not read`);
    }
    loaders.push(
      Object.freeze({ name: loaderName, action: declared, input: loaderInput, invalidatedBy }),
    );
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

  let prefetch: PagePrefetch | null = null;
  if (config.prefetch !== undefined) {
    if (!(PAGE_PREFETCH as readonly string[]).includes(config.prefetch)) {
      fail("prefetch", `must be one of ${PAGE_PREFETCH.join(", ")}`);
    }
    prefetch = config.prefetch;
  }

  const islandsConfig: unknown = config.islands ?? {};
  if (!isPlainObject(islandsConfig)) {
    reject("REX226", "islands", "must map declared regions to load, idle, visible or never");
  }
  const islands: Record<string, IslandMode> = {};
  for (const [region, mode] of Object.entries(islandsConfig as Record<string, unknown>)) {
    if (!regionNames.has(region)) {
      reject("REX226", `islands.${region}`, `names region "${region}" the page does not declare`);
    }
    if (!(ISLAND_MODES as readonly unknown[]).includes(mode)) {
      reject("REX226", `islands.${region}`, `must be one of ${ISLAND_MODES.join(", ")}`);
    }
    islands[region] = mode as IslandMode;
  }
  const shortcutAction = actions.find((entry) => entry.shortcut !== null);
  if (
    shortcutAction !== undefined &&
    regionNames.size > 0 &&
    [...regionNames].every((region) => islands[region] === "never")
  ) {
    reject(
      "REX226",
      "islands",
      `leaves every region never hydrated while action "${shortcutAction.id}" has shortcut ${shortcutAction.shortcut}`,
    );
  }

  if (id === NOT_FOUND_PAGE_ID) {
    if (route.route !== NOT_FOUND_ROUTE) {
      reject("REX230", "route", `must be ${NOT_FOUND_ROUTE} on the reserved not-found page`);
    }
    if (chrome.nav) {
      reject("REX230", "chrome.nav", "must be false on the reserved not-found page");
    }
  } else if (route.route === NOT_FOUND_ROUTE) {
    reject("REX230", "route", `${NOT_FOUND_ROUTE} is reserved for the "${NOT_FOUND_PAGE_ID}" page`);
  }

  return Object.freeze({
    kind: "page",
    id,
    name: id,
    route: route.route,
    routeParams: route.params,
    params,
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
    pathsAction,
    fallback,
    load: Object.freeze({ ...loadConfig }) as L,
    loaders: Object.freeze(loaders),
    cache,
    transition,
    prefetch,
    islands: Object.freeze(islands) as PageIslands<R>,
  });
}

function isImageReference(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
