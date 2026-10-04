import type { AnyAction } from "./action.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
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

export interface PageChromeConfig {
  readonly header?: boolean;
  readonly nav?: boolean;
  readonly back?: string | null;
  readonly title?: string;
}

export interface PageChrome {
  readonly header: boolean;
  readonly nav: boolean;
  readonly back: string | null;
  readonly title: string;
}

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
> {
  readonly route: string;
  readonly params?: P;
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
}

export type AnyPage = PageDeclaration<
  string,
  PageParamsSchema,
  RexDataState,
  string,
  string,
  AnyAction
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
]);
const CHROME_KEYS = new Set(["header", "nav", "back", "title"]);

export function page<
  const N extends string,
  P extends PageParamsSchema = z.ZodObject<{}>,
  const S extends readonly RexDataState[] = typeof REX_DATA_STATES,
  const R extends string = never,
  const O extends string = never,
  const A extends AnyAction = never,
>(name: N, config: PageConfig<P, S, R, O, A>): PageDeclaration<N, P, S[number], R, O, A> {
  const id = declarationName("page", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("page", id, field, problem);
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
  const chrome: PageChrome = Object.freeze({
    header: chromeConfig.header ?? true,
    nav: chromeConfig.nav ?? true,
    back,
    title: chromeConfig.title ?? titleFromId(id),
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
  });
}
