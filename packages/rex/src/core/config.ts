import { deprecated, type DeprecationWarn } from "./deprecated.ts";
import { RexError, type RexErrorCode } from "./errors.ts";
import { PAGE_RENDER_MODES, type PageRender } from "./page.ts";
import type { RegistrySnapshot } from "./registry.ts";

export const CONFIG_FILE = "rex.config.ts";

export interface RexFetchHandler {
  fetch(request: Request): Response | Promise<Response>;
}

export interface RexConfigApp {
  readonly name: string;
  readonly registry: RegistrySnapshot;
}

export const CSP_MODES = ["strict", "report", "off"] as const;
export type CspMode = (typeof CSP_MODES)[number];

export const I18N_ROUTING = ["prefix", "none"] as const;
export type I18nRouting = (typeof I18N_ROUTING)[number];

export const IMAGE_FORMATS = ["avif", "webp", "jpeg", "png"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const UI_KITS = ["designx", "none"] as const;
export type UiKit = (typeof UI_KITS)[number];

export const FONT_STYLES = ["normal", "italic"] as const;
export type FontStyle = (typeof FONT_STYLES)[number];

export interface RenderConfig {
  readonly default?: PageRender;
}

export interface BudgetsConfig {
  readonly core?: number;
  readonly client?: number;
  readonly page?: number;
}

export interface SecurityConfig {
  readonly csp?: CspMode;
  readonly origins?: readonly string[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly secretNames?: readonly string[];
}

export interface I18nConfig {
  readonly locales: readonly string[];
  readonly default: string;
  readonly routing?: I18nRouting;
}

export interface ImagesConfig {
  readonly sizes?: readonly number[];
  readonly formats?: readonly ImageFormat[];
}

export interface FontSpec {
  readonly family: string;
  readonly src: string;
  readonly weight?: string | number;
  readonly style?: FontStyle;
  readonly preload?: boolean;
}

export interface RexLogger {
  debug(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  info(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  warn(message: string, attributes?: Readonly<Record<string, unknown>>): void;
  error(message: string, attributes?: Readonly<Record<string, unknown>>): void;
}

export interface RexTracer {
  startSpan(name: string, ...rest: never[]): unknown;
}

export interface TelemetryConfig {
  readonly tracer?: RexTracer;
  readonly logger?: RexLogger;
}

export interface ClientConfig {
  readonly apiOrigin?: string;
}

export interface TokenAllowLists {
  readonly colors?: readonly string[];
  readonly spacing?: readonly string[];
  readonly classes?: readonly string[];
}

export interface CheckConfig {
  readonly tokens?: TokenAllowLists;
}

export interface RexOptionsConfig {
  readonly render?: RenderConfig;
  readonly budgets?: BudgetsConfig;
  readonly security?: SecurityConfig;
  readonly i18n?: I18nConfig;
  readonly images?: ImagesConfig;
  readonly fonts?: readonly FontSpec[];
  readonly telemetry?: TelemetryConfig;
  readonly ui?: UiKit;
  readonly client?: ClientConfig;
  readonly compiler?: boolean;
  readonly devtools?: boolean;
  readonly tailwind?: boolean;
  readonly check?: CheckConfig;
}

export interface RexConfig<A extends RexConfigApp = RexConfigApp> extends RexOptionsConfig {
  readonly app: A;
  readonly server?: (app: A) => RexFetchHandler;
}

export interface ResolvedBudgets {
  readonly core: number;
  readonly client: number;
  readonly page: number;
}

export interface ResolvedSecurity {
  readonly csp: CspMode;
  readonly origins: readonly string[];
  readonly headers: Readonly<Record<string, string>>;
  readonly secretNames: readonly string[];
}

export interface ResolvedI18n {
  readonly locales: readonly string[];
  readonly default: string;
  readonly routing: I18nRouting;
}

export interface ResolvedFont {
  readonly family: string;
  readonly src: string;
  readonly weight: string | null;
  readonly style: FontStyle;
  readonly preload: boolean;
}

export interface ResolvedRexOptions {
  readonly render: { readonly default: PageRender };
  readonly budgets: ResolvedBudgets;
  readonly security: ResolvedSecurity;
  readonly i18n: ResolvedI18n | null;
  readonly images: { readonly sizes: readonly number[]; readonly formats: readonly ImageFormat[] };
  readonly fonts: readonly ResolvedFont[];
  readonly telemetry: { readonly tracer: RexTracer | null; readonly logger: RexLogger | null };
  readonly ui: UiKit;
  readonly client: { readonly apiOrigin: string | null };
  readonly compiler: boolean;
  readonly devtools: boolean;
  readonly tailwind: boolean;
  readonly check: {
    readonly tokens: {
      readonly colors: readonly string[];
      readonly spacing: readonly string[];
      readonly classes: readonly string[];
    };
  };
}

export interface ResolvedRexConfig<A extends RexConfigApp = RexConfigApp>
  extends ResolvedRexOptions {
  readonly app: A;
  readonly server: ((app: A) => RexFetchHandler) | null;
}

export const DEFAULT_BUDGETS: ResolvedBudgets = Object.freeze({ core: 15, client: 30, page: 50 });
export const DEFAULT_IMAGE_SIZES: readonly number[] = Object.freeze([
  640, 750, 828, 1080, 1200, 1920,
]);
export const DEFAULT_IMAGE_FORMATS: readonly ImageFormat[] = Object.freeze(["avif", "webp"]);

export class RexConfigError extends RexError {
  readonly field: string;

  constructor(code: RexErrorCode, field: string, problem: string) {
    super(code, `${CONFIG_FILE}: field "${field}" ${problem}`);
    this.name = "RexConfigError";
    this.field = field;
  }
}

const REX_CONFIG_BRAND: unique symbol = Symbol.for("rex.config");

const CONFIG_KEYS: Readonly<Record<string, RexErrorCode>> = {
  app: "REX111",
  server: "REX112",
  render: "REX113",
  budgets: "REX114",
  security: "REX115",
  i18n: "REX116",
  images: "REX117",
  fonts: "REX118",
  telemetry: "REX119",
  ui: "REX120",
  client: "REX121",
  compiler: "REX122",
  devtools: "REX122",
  tailwind: "REX122",
  check: "REX123",
};

const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const SECRET_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Fail = (field: string, problem: string) => never;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function failFor(code: RexErrorCode): Fail {
  return (field, problem) => {
    throw new RexConfigError(code, field, problem);
  };
}

function objectAt(value: unknown, field: string, keys: readonly string[], fail: Fail) {
  if (!isRecord(value)) fail(field, "must be an object");
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) fail(`${field}.${key}`, `is not one of ${keys.join(", ")}`);
  }
  return record;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  fail: Fail,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(field, `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function stringList(
  value: unknown,
  field: string,
  fail: Fail,
  check?: (item: string) => string | null,
): readonly string[] {
  if (!Array.isArray(value)) fail(field, "must be a list of strings");
  const items = value as unknown[];
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (typeof item !== "string" || item.trim() === "") {
      fail(`${field}.${index}`, "must be a non-empty string");
    }
    const text = item as string;
    const problem = check?.(text) ?? null;
    if (problem !== null) fail(`${field}.${index}`, problem);
    if (seen.has(text)) fail(`${field}.${index}`, `repeats ${JSON.stringify(text)}`);
    seen.add(text);
  }
  return Object.freeze([...(items as string[])]);
}

function originProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "must be an http(s) origin such as https://example.com";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "must use http or https";
  }
  if (url.origin !== value) return `must be an origin without a path, such as ${url.origin}`;
  return null;
}

function flag(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") failFor("REX122")(field, "must be true or false");
  return value as boolean;
}

function parseRender(value: unknown): ResolvedRexOptions["render"] {
  const fail = failFor("REX113");
  if (value === undefined) return Object.freeze({ default: "ssr" });
  const record = objectAt(value, "render", ["default"], fail);
  const mode =
    record.default === undefined
      ? "ssr"
      : oneOf(record.default, PAGE_RENDER_MODES, "render.default", fail);
  return Object.freeze({ default: mode });
}

function parseBudgets(value: unknown): ResolvedBudgets {
  const fail = failFor("REX114");
  if (value === undefined) return DEFAULT_BUDGETS;
  const record = objectAt(value, "budgets", ["core", "client", "page"], fail);
  const budget = (key: keyof ResolvedBudgets): number => {
    const entry = record[key];
    if (entry === undefined) return DEFAULT_BUDGETS[key];
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0) {
      fail(`budgets.${key}`, "must be a positive number of gzipped kilobytes");
    }
    return entry as number;
  };
  return Object.freeze({ core: budget("core"), client: budget("client"), page: budget("page") });
}

function parseSecurity(value: unknown): ResolvedSecurity {
  const fail = failFor("REX115");
  if (value === undefined) {
    return Object.freeze({
      csp: "strict",
      origins: Object.freeze([]),
      headers: Object.freeze({}),
      secretNames: Object.freeze([]),
    });
  }
  const record = objectAt(value, "security", ["csp", "origins", "headers", "secretNames"], fail);
  const csp =
    record.csp === undefined ? "strict" : oneOf(record.csp, CSP_MODES, "security.csp", fail);
  const origins =
    record.origins === undefined
      ? Object.freeze([])
      : stringList(record.origins, "security.origins", fail, originProblem);
  let headers: Readonly<Record<string, string>> = Object.freeze({});
  if (record.headers !== undefined) {
    if (!isRecord(record.headers)) fail("security.headers", "must map header names to values");
    const entries: [string, string][] = [];
    for (const [name, header] of Object.entries(record.headers as Record<string, unknown>)) {
      if (!HEADER_NAME_PATTERN.test(name)) {
        fail(`security.headers.${name}`, "is not a valid header name");
      }
      if (typeof header !== "string") fail(`security.headers.${name}`, "must be a string");
      entries.push([name.toLowerCase(), header as string]);
    }
    headers = Object.freeze(Object.fromEntries(entries));
  }
  const secretNames =
    record.secretNames === undefined
      ? Object.freeze([])
      : stringList(record.secretNames, "security.secretNames", fail, (name) =>
          SECRET_NAME_PATTERN.test(name) ? null : "must be an environment variable name",
        );
  return Object.freeze({ csp, origins, headers, secretNames });
}

function parseI18n(value: unknown): ResolvedI18n | null {
  const fail = failFor("REX116");
  if (value === undefined) return null;
  const record = objectAt(value, "i18n", ["locales", "default", "routing"], fail);
  const locales = stringList(record.locales, "i18n.locales", fail, (locale) =>
    LOCALE_PATTERN.test(locale) ? null : "must be a locale tag such as en or pt-BR",
  );
  if (locales.length === 0) fail("i18n.locales", "must list at least one locale");
  if (typeof record.default !== "string" || !locales.includes(record.default)) {
    fail("i18n.default", "must be one of i18n.locales");
  }
  const routing =
    record.routing === undefined
      ? "none"
      : oneOf(record.routing, I18N_ROUTING, "i18n.routing", fail);
  return Object.freeze({ locales, default: record.default as string, routing });
}

function parseImages(value: unknown): ResolvedRexOptions["images"] {
  const fail = failFor("REX117");
  if (value === undefined) {
    return Object.freeze({ sizes: DEFAULT_IMAGE_SIZES, formats: DEFAULT_IMAGE_FORMATS });
  }
  const record = objectAt(value, "images", ["sizes", "formats"], fail);
  let sizes = DEFAULT_IMAGE_SIZES;
  if (record.sizes !== undefined) {
    if (!Array.isArray(record.sizes) || record.sizes.length === 0) {
      fail("images.sizes", "must be a non-empty list of widths");
    }
    for (const [index, size] of (record.sizes as unknown[]).entries()) {
      if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
        fail(`images.sizes.${index}`, "must be a positive whole number of pixels");
      }
    }
    sizes = Object.freeze([...new Set(record.sizes as number[])].sort((a, b) => a - b));
  }
  let formats = DEFAULT_IMAGE_FORMATS;
  if (record.formats !== undefined) {
    if (!Array.isArray(record.formats) || record.formats.length === 0) {
      fail("images.formats", "must be a non-empty list of formats");
    }
    formats = Object.freeze(
      (record.formats as unknown[]).map((format, index) =>
        oneOf(format, IMAGE_FORMATS, `images.formats.${index}`, fail),
      ),
    );
  }
  return Object.freeze({ sizes, formats });
}

function parseFonts(value: unknown): readonly ResolvedFont[] {
  const fail = failFor("REX118");
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) fail("fonts", "must be a list of font specs");
  return Object.freeze(
    (value as unknown[]).map((entry, index): ResolvedFont => {
      const field = `fonts.${index}`;
      const record = objectAt(
        entry,
        field,
        ["family", "src", "weight", "style", "preload"],
        fail,
      );
      if (typeof record.family !== "string" || record.family.trim() === "") {
        fail(`${field}.family`, "must be a non-empty string");
      }
      const src = record.src;
      if (
        typeof src !== "string" ||
        !(src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://"))
      ) {
        fail(`${field}.src`, "must be a URL or a path starting with /");
      }
      let weight: string | null = null;
      if (record.weight !== undefined) {
        if (
          !(typeof record.weight === "number" && Number.isInteger(record.weight)) &&
          !(typeof record.weight === "string" && /^\d{3}( \d{3})?$/.test(record.weight))
        ) {
          fail(`${field}.weight`, "must be a weight such as 400 or a range such as \"100 900\"");
        }
        weight = String(record.weight);
      }
      const style =
        record.style === undefined
          ? "normal"
          : oneOf(record.style, FONT_STYLES, `${field}.style`, fail);
      if (record.preload !== undefined && typeof record.preload !== "boolean") {
        fail(`${field}.preload`, "must be true or false");
      }
      return Object.freeze({
        family: record.family as string,
        src: src as string,
        weight,
        style,
        preload: (record.preload as boolean | undefined) ?? true,
      });
    }),
  );
}

const LOGGER_METHODS = ["debug", "info", "warn", "error"] as const;

function parseTelemetry(value: unknown): ResolvedRexOptions["telemetry"] {
  const fail = failFor("REX119");
  if (value === undefined) return Object.freeze({ tracer: null, logger: null });
  const record = objectAt(value, "telemetry", ["tracer", "logger"], fail);
  let tracer: RexTracer | null = null;
  if (record.tracer !== undefined) {
    const candidate = record.tracer as { startSpan?: unknown } | null;
    if (typeof candidate !== "object" || candidate === null) {
      fail("telemetry.tracer", "must be an OpenTelemetry tracer");
    }
    if (typeof (candidate as { startSpan?: unknown }).startSpan !== "function") {
      fail("telemetry.tracer", "must be an OpenTelemetry tracer with startSpan");
    }
    tracer = candidate as RexTracer;
  }
  let logger: RexLogger | null = null;
  if (record.logger !== undefined) {
    const candidate = record.logger as Record<string, unknown> | null;
    if (typeof candidate !== "object" || candidate === null) {
      fail("telemetry.logger", "must be a logger object");
    }
    for (const method of LOGGER_METHODS) {
      if (typeof (candidate as Record<string, unknown>)[method] !== "function") {
        fail(`telemetry.logger.${method}`, "must be a function");
      }
    }
    logger = candidate as unknown as RexLogger;
  }
  return Object.freeze({ tracer, logger });
}

function parseClient(value: unknown): ResolvedRexOptions["client"] {
  const fail = failFor("REX121");
  if (value === undefined) return Object.freeze({ apiOrigin: null });
  const record = objectAt(value, "client", ["apiOrigin"], fail);
  if (record.apiOrigin === undefined) return Object.freeze({ apiOrigin: null });
  if (typeof record.apiOrigin !== "string") fail("client.apiOrigin", "must be a string");
  const problem = originProblem(record.apiOrigin as string);
  if (problem !== null) fail("client.apiOrigin", problem);
  return Object.freeze({ apiOrigin: record.apiOrigin as string });
}

function parseCheck(value: unknown): ResolvedRexOptions["check"] {
  const fail = failFor("REX123");
  const empty = Object.freeze([]) as readonly string[];
  if (value === undefined) {
    return Object.freeze({ tokens: Object.freeze({ colors: empty, spacing: empty, classes: empty }) });
  }
  const record = objectAt(value, "check", ["tokens"], fail);
  if (record.tokens === undefined) {
    return Object.freeze({ tokens: Object.freeze({ colors: empty, spacing: empty, classes: empty }) });
  }
  const tokens = objectAt(record.tokens, "check.tokens", ["colors", "spacing", "classes"], fail);
  const list = (key: "colors" | "spacing" | "classes") =>
    tokens[key] === undefined ? empty : stringList(tokens[key], `check.tokens.${key}`, fail);
  return Object.freeze({
    tokens: Object.freeze({ colors: list("colors"), spacing: list("spacing"), classes: list("classes") }),
  });
}

function checkKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      failFor("REX110")(key, `is not a config field; use ${allowed.join(", ")}`);
    }
  }
}

export function resolveOptions(value: RexOptionsConfig = {}): ResolvedRexOptions {
  if (!isRecord(value)) failFor("REX102")("default", "must be a config object");
  const record = value as Record<string, unknown>;
  checkKeys(
    record,
    Object.keys(CONFIG_KEYS).filter((key) => key !== "app" && key !== "server"),
  );
  return Object.freeze({
    render: parseRender(record.render),
    budgets: parseBudgets(record.budgets),
    security: parseSecurity(record.security),
    i18n: parseI18n(record.i18n),
    images: parseImages(record.images),
    fonts: parseFonts(record.fonts),
    telemetry: parseTelemetry(record.telemetry),
    ui: record.ui === undefined ? "none" : oneOf(record.ui, UI_KITS, "ui", failFor("REX120")),
    client: parseClient(record.client),
    compiler: flag(record.compiler, "compiler", true),
    devtools: flag(record.devtools, "devtools", true),
    tailwind: flag(record.tailwind, "tailwind", false),
    check: parseCheck(record.check),
  });
}

export const DEFAULT_OPTIONS: ResolvedRexOptions = resolveOptions();

function isConfigApp(value: unknown): value is RexConfigApp {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; registry?: unknown };
  if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
  const registry = candidate.registry as { actions?: unknown; pages?: unknown } | null;
  return (
    typeof registry === "object" &&
    registry !== null &&
    Array.isArray(registry.actions) &&
    Array.isArray(registry.pages)
  );
}

export function parseConfig<A extends RexConfigApp = RexConfigApp>(
  value: unknown,
): ResolvedRexConfig<A> {
  if (!isRecord(value)) {
    throw new RexError("REX102", `${CONFIG_FILE}: the default export must be defineConfig({ app })`);
  }
  checkKeys(value, Object.keys(CONFIG_KEYS));
  if (!isConfigApp(value.app)) {
    failFor("REX111")("app", "must be the app bundle imported from rex:app");
  }
  if (value.server !== undefined && typeof value.server !== "function") {
    failFor("REX112")("server", "must be a function from the app bundle to a fetch app");
  }
  const { app, server, ...options } = value;
  return Object.freeze({
    ...resolveOptions(options as RexOptionsConfig),
    app: app as A,
    server: (server as ((app: A) => RexFetchHandler) | undefined) ?? null,
  });
}

export function defineConfig<const A extends RexConfigApp>(config: RexConfig<A>): RexConfig<A> {
  parseConfig<A>(config);
  const branded = { ...config };
  Object.defineProperty(branded, REX_CONFIG_BRAND, { value: true, enumerable: false });
  return Object.freeze(branded);
}

export function isDefinedConfig(value: unknown): value is RexConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [REX_CONFIG_BRAND]?: unknown })[REX_CONFIG_BRAND] === true
  );
}

export function isFetchHandler(value: unknown): value is RexFetchHandler {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function"
  );
}

export type RexConfigExport =
  | { readonly kind: "config"; readonly config: ResolvedRexConfig; readonly options: ResolvedRexOptions }
  | { readonly kind: "legacy"; readonly server: RexFetchHandler; readonly options: ResolvedRexOptions };

export const LEGACY_CONFIG_MESSAGE = `${CONFIG_FILE} default-exports a bare Hono app; wrap it in defineConfig({ app, server }) or run rex migrate`;

export function readConfigExport(exported: unknown, warn?: DeprecationWarn): RexConfigExport {
  if (isFetchHandler(exported)) {
    deprecated("REX101", LEGACY_CONFIG_MESSAGE, warn);
    return { kind: "legacy", server: exported, options: DEFAULT_OPTIONS };
  }
  if (exported === undefined) {
    throw new RexError("REX102", `${CONFIG_FILE} has no default export`);
  }
  const config = parseConfig(exported);
  return { kind: "config", config, options: config };
}

export type DefaultServerFactory = (app: RexConfigApp) => RexFetchHandler;

export function configServer(read: RexConfigExport, fallback: DefaultServerFactory): RexFetchHandler {
  if (read.kind === "legacy") return read.server;
  const { config } = read;
  const server = config.server === null ? fallback(config.app) : config.server(config.app);
  if (!isFetchHandler(server)) {
    failFor("REX112")("server", "must return a fetch app such as createRexServer(...)");
  }
  return server;
}
