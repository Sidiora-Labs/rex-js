export const REX_ERRORS_DOCS_BASE = "https://rex.sidioralabs.com/errors";

export type RexErrorArea = "config" | "declaration" | "runtime" | "server" | "checker" | "cli";

export interface RexErrorAreaInfo {
  readonly prefix: string;
  readonly title: string;
}

export const REX_ERROR_AREAS = {
  config: { prefix: "REX1", title: "Configuration" },
  declaration: { prefix: "REX2", title: "Declarations" },
  runtime: { prefix: "REX3", title: "Runtime" },
  server: { prefix: "REX4", title: "Server" },
  checker: { prefix: "REX5", title: "Checker and manifest" },
  cli: { prefix: "REX6", title: "CLI" },
} as const satisfies Readonly<Record<RexErrorArea, RexErrorAreaInfo>>;

export interface RexErrorEntry {
  readonly area: RexErrorArea;
  readonly title: string;
  readonly hint: string;
}

export const REX_ERROR_CATALOG = {
  REX100: {
    area: "config",
    title: "rex.config.ts is missing",
    hint: "Create rex.config.ts at the app root that default-exports defineConfig({ app }) with app imported from rex:app.",
  },
  REX101: {
    area: "config",
    title: "rex.config.ts default-exports a bare Hono app",
    hint: "Wrap it: export default defineConfig({ app, server: (app) => createRexServer({ ... }) }); rex migrate applies this change.",
  },
  REX102: {
    area: "config",
    title: "rex.config.ts default export is not a Rex config",
    hint: "Default-export defineConfig({ app }) from rex.config.ts.",
  },
  REX110: {
    area: "config",
    title: "Unknown config field",
    hint: "Remove the field or correct its spelling; the accepted fields are listed in the config reference.",
  },
  REX111: {
    area: "config",
    title: "Invalid config app",
    hint: "Set app to the bundle imported from rex:app: import app from \"rex:app\".",
  },
  REX112: {
    area: "config",
    title: "Invalid config server",
    hint: "Set server to a function from the app bundle to a fetch app, such as (app) => createRexServer({ registry: app.registry, ledger, actor }).",
  },
  REX113: {
    area: "config",
    title: "Invalid config render",
    hint: "Set render to { default: \"ssr\" | \"csr\" | \"ssg\" | \"static\" }.",
  },
  REX114: {
    area: "config",
    title: "Invalid config budgets",
    hint: "Set budgets.core, budgets.client and budgets.page to positive numbers of gzipped kilobytes.",
  },
  REX115: {
    area: "config",
    title: "Invalid config security",
    hint: "Set security to { csp: \"strict\" | \"report\" | \"off\", origins: [\"https://example.com\"], headers?: { name: value }, secretNames?: [\"NAME\"] }.",
  },
  REX116: {
    area: "config",
    title: "Invalid config i18n",
    hint: "Set i18n to { locales: [\"en\", ...], default: one of the locales, routing: \"prefix\" | \"none\" }.",
  },
  REX117: {
    area: "config",
    title: "Invalid config images",
    hint: "Set images to { sizes: positive integer widths, formats: a list of avif, webp, jpeg and png }.",
  },
  REX118: {
    area: "config",
    title: "Invalid config fonts",
    hint: "Set fonts to a list of { family, src, weight?, style?, preload? } with src a URL or a path starting with /.",
  },
  REX119: {
    area: "config",
    title: "Invalid config telemetry",
    hint: "Set telemetry to { tracer?: an OpenTelemetry tracer, logger?: { debug, info, warn, error } }.",
  },
  REX120: {
    area: "config",
    title: "Invalid config ui",
    hint: "Set ui to \"designx\" or \"none\".",
  },
  REX121: {
    area: "config",
    title: "Invalid config client",
    hint: "Set client to { apiOrigin?: an http(s) origin such as https://api.example.com }.",
  },
  REX122: {
    area: "config",
    title: "Invalid config flag",
    hint: "Set compiler, devtools and tailwind to true or false.",
  },
  REX123: {
    area: "config",
    title: "Invalid config check",
    hint: "Set check to { tokens?: { colors?, spacing?, classes? } } with each allow list a list of strings.",
  },
  REX200: {
    area: "declaration",
    title: "Invalid page render mode",
    hint: "Set render to \"ssr\", \"csr\", \"ssg\" or \"static\", or leave it out to use the app default.",
  },
  REX201: {
    area: "declaration",
    title: "Invalid page revalidate",
    hint: "Set revalidate to a positive whole number of seconds on a page with render \"ssg\", or remove it.",
  },
  REX202: {
    area: "declaration",
    title: "Invalid page paths",
    hint: "Set paths to a function returning the params of every page to prerender, on a page with render \"ssg\" or \"static\" and route params.",
  },
  REX203: {
    area: "declaration",
    title: "Invalid page loader",
    hint: "Map each camelCase loader name to a read action or to { action: readAction, input: (params) => input }.",
  },
  REX204: {
    area: "declaration",
    title: "Invalid page cache",
    hint: "Set cache to { staleTime: milliseconds } with a whole number of zero or more.",
  },
  REX205: {
    area: "declaration",
    title: "Invalid page transition",
    hint: "Set transition to \"view\" or \"none\".",
  },
  REX206: {
    area: "declaration",
    title: "Invalid page chrome components",
    hint: "Set chrome.components to { Button?, Sheet?, PaletteItem?, Outcome? } with each value a component.",
  },
  REX207: {
    area: "declaration",
    title: "Invalid action form options",
    hint: "Set form to { redirect?: a path starting with /, confirmTitle?: a non-empty string }.",
  },
  REX208: {
    area: "declaration",
    title: "Invalid action JSON Schema override",
    hint: "Set jsonSchema to { input?: JSON Schema object, output?: JSON Schema object }.",
  },
  REX209: {
    area: "declaration",
    title: "Page loader names an unregistered action",
    hint: "Register the loader's read action in app/actions so the manifest and the router know it.",
  },
  REX210: {
    area: "declaration",
    title: "Schema cannot be represented as JSON Schema",
    hint: "Use a zod schema that JSON Schema can describe, or declare jsonSchema explicitly on the declaration.",
  },
  REX211: {
    area: "declaration",
    title: "Invalid entity declaration",
    hint: "Fix the named field of the entity(name, { fields, key?, label? }) declaration; field names are camelCase and every field is a Standard Schema such as a Rex field helper.",
  },
  REX212: {
    area: "declaration",
    title: "Invalid action declaration",
    hint: "Fix the named field of the action(name, { label, effect, input, output, policy, handler, ... }) declaration as described in the primitives reference.",
  },
  REX213: {
    area: "declaration",
    title: "Invalid page declaration",
    hint: "Fix the named field of the page(name, { route, chrome, regions, overlays, actions, ... }) declaration in app/pages/<page>/page.ts.",
  },
  REX214: {
    area: "declaration",
    title: "Invalid policy declaration",
    hint: "Fix the named field of the policy(name, { permissions, grants }) declaration; grants may only name declared permissions.",
  },
  REX215: {
    area: "declaration",
    title: "Invalid policy predicate",
    hint: "Build predicates with can(permission), requires({ unlocked?, account?, custody?, permissions? }), allOf(...) and anyOf(...) with at least one condition each.",
  },
  REX216: {
    area: "declaration",
    title: "Invalid flow declaration",
    hint: "Fix the named field of the flow(name, { journal, input, steps }) declaration; each step is { action, input? } or an approval gate.",
  },
  REX217: {
    area: "declaration",
    title: "Duplicate declaration id",
    hint: "Give each entity, action, page, policy and flow a unique id, or register the same declaration object only once.",
  },
  REX218: {
    area: "declaration",
    title: "Invalid name",
    hint: "Use a name that starts with a lowercase letter and contains only lowercase letters, digits, dot and dash; component names are PascalCase.",
  },
  REX219: {
    area: "declaration",
    title: "Invalid action shortcut",
    hint: "Write the shortcut as ordered modifiers mod, shift, alt joined by + and one key, such as mod+shift+s; mod+k and escape are reserved by Rex.",
  },
  REX220: {
    area: "declaration",
    title: "Invalid page route",
    hint: "Write the route as / or /segment/:param with lowercase static segments, camelCase params, no repeated param and no trailing slash.",
  },
  REX221: {
    area: "declaration",
    title: "Duplicate enum value",
    hint: "List each value once in enumOf([...]).",
  },
  REX222: {
    area: "declaration",
    title: "Page names an unregistered action",
    hint: "Register the action in app/actions or remove it from the page actions list.",
  },
  REX223: {
    area: "declaration",
    title: "Page names an unknown page",
    hint: "Point recovery and chrome.back at the id of a registered page.",
  },
  REX224: {
    area: "declaration",
    title: "Registered value is not a complete declaration",
    hint: "Register only values returned by entity(), action(), page(), policy() and flow().",
  },
  REX300: {
    area: "runtime",
    title: "Schema validates asynchronously",
    hint: "Validate the schema with validateStandard (async) or use a schema whose ~standard.validate returns synchronously.",
  },
  REX301: {
    area: "runtime",
    title: "Unknown declaration",
    hint: "Look up a declaration that is registered in the app; rex manifest lists every registered id.",
  },
  REX302: {
    area: "runtime",
    title: "Invalid journal id",
    hint: "Pass a non-empty string for the flow id and the instance id.",
  },
  REX303: {
    area: "runtime",
    title: "Unknown flow instance",
    hint: "Start the flow with runFlow before recording entries or deciding on its gates.",
  },
  REX304: {
    area: "runtime",
    title: "Flow instance belongs to another flow",
    hint: "Use a fresh instance id for each flow; an instance id is bound to the flow that opened it.",
  },
  REX305: {
    area: "runtime",
    title: "Unknown store filter field",
    hint: "Filter a store list only by fields declared on its entity.",
  },
  REX310: {
    area: "runtime",
    title: "Hydration mismatch",
    hint: "Render the same markup on the server and the client: read time, randomness and browser-only values in effects, not during render.",
  },
  REX320: {
    area: "runtime",
    title: "Page declaration changed",
    hint: "No action needed: a page.ts edit invalidates rex:app and the page chunk and reloads the page; component edits keep state through HMR.",
  },
  REX330: {
    area: "runtime",
    title: "Region failed to render",
    hint: "Fix the error thrown by the region; the page shows its recoverable-error state and Retry remounts the region.",
  },
  REX440: {
    area: "server",
    title: "Server-only module imported by client code",
    hint: "Import rex/server, app/server and modules marked import \"rex/server-only\" only from actions, rex.config.ts and other server code.",
  },
  REX450: {
    area: "server",
    title: "Runtime not available for the adapter",
    hint: "Run the bun adapter under Bun and the deno adapter under Deno, or pick the matching rex build --target.",
  },
  REX500: {
    area: "checker",
    title: "Manifest scan failed",
    hint: "Fix the declaration error reported with the scan so the app declarations load, then run rex manifest again.",
  },
  REX501: {
    area: "checker",
    title: "Invalid manifest build option",
    hint: "Pass buildManifest an app name that is a non-empty string.",
  },
  REX502: {
    area: "checker",
    title: "Manifest value cannot be serialised",
    hint: "Keep declaration metadata to JSON values: finite numbers, strings, booleans, null, arrays and plain objects.",
  },
  REX600: {
    area: "cli",
    title: "Invalid CLI command definition",
    hint: "Declare each command, argument and option once with a --long option name, <required> or [optional] arguments in that order, and no value on a --no- flag.",
  },
  REX610: {
    area: "cli",
    title: "Codemod left a placeholder",
    hint: "Replace the placeholder the codemod wrote, such as Img width and height, with the real values and run rex check.",
  },
} as const satisfies Readonly<Record<string, RexErrorEntry>>;

export type RexErrorCode = keyof typeof REX_ERROR_CATALOG;

export const REX_ERROR_CODE_PATTERN = /^REX[1-6][0-9]{2}$/;

export function isRexErrorCode(value: unknown): value is RexErrorCode {
  return typeof value === "string" && Object.hasOwn(REX_ERROR_CATALOG, value);
}

export function errorDocs(code: RexErrorCode): string {
  return `${REX_ERRORS_DOCS_BASE}/${code}`;
}

export interface RexErrorLocation {
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
}

export interface RexErrorOptions extends RexErrorLocation {
  readonly hint?: string;
  readonly cause?: unknown;
}

const REX_ERROR_BRAND: unique symbol = Symbol.for("rex.error");

export class RexError extends Error {
  readonly code: RexErrorCode;
  readonly detail: string;
  readonly hint: string;
  readonly docs: string;
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;

  constructor(code: RexErrorCode, message: string, options: RexErrorOptions = {}) {
    if (!isRexErrorCode(code)) throw new TypeError(`RexError: unknown error code ${String(code)}`);
    super(`${code} ${message}`, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RexError";
    this.code = code;
    this.detail = message;
    this.hint = options.hint ?? REX_ERROR_CATALOG[code].hint;
    this.docs = errorDocs(code);
    this.file = options.file ?? null;
    this.line = options.line ?? null;
    this.column = options.column ?? null;
    Object.defineProperty(this, REX_ERROR_BRAND, { value: true, enumerable: false });
  }
}

export function isRexError(value: unknown): value is RexError {
  return (
    value instanceof Error &&
    (value as { [REX_ERROR_BRAND]?: unknown })[REX_ERROR_BRAND] === true &&
    isRexErrorCode((value as { code?: unknown }).code)
  );
}

export interface RexDeclarationErrorDetails {
  readonly declaration: string;
  readonly id: string;
  readonly field: string;
  readonly problem: string;
}

export class RexDeclarationOptionError extends RexError {
  readonly declaration: string;
  readonly id: string;
  readonly field: string;

  constructor(code: RexErrorCode, details: RexDeclarationErrorDetails) {
    super(
      code,
      `${details.declaration} ${JSON.stringify(details.id)}: field "${details.field}" ${details.problem}`,
    );
    this.name = "RexDeclarationOptionError";
    this.declaration = details.declaration;
    this.id = details.id;
    this.field = details.field;
  }
}

export function formatRexError(error: RexError): string {
  const location =
    error.file === null
      ? ""
      : ` (${error.file}${error.line === null ? "" : `:${error.line}${error.column === null ? "" : `:${error.column}`}`})`;
  return `${error.message}${location}\n  hint: ${error.hint}\n  docs: ${error.docs}`;
}

export function errorDetail(error: unknown): string {
  if (isRexError(error)) return error.detail;
  return error instanceof Error ? error.message : String(error);
}

export interface RexStackFrame {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

const STACK_FRAME = /^\s*at (?:.*? \()?(.+?):(\d+):(\d+)\)?\s*$/;

function frameFile(raw: string): string {
  if (!raw.startsWith("file://")) return raw;
  const path = decodeURIComponent(raw.slice("file://".length));
  return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
}

export function stackFrames(stack: string | undefined): RexStackFrame[] {
  if (stack === undefined) return [];
  const frames: RexStackFrame[] = [];
  for (const text of stack.split("\n")) {
    const match = STACK_FRAME.exec(text);
    if (match === null) continue;
    frames.push({
      file: frameFile(match[1] as string),
      line: Number(match[2]),
      column: Number(match[3]),
    });
  }
  return frames;
}

export function locateRexError(error: RexError, location: RexErrorLocation): RexError {
  if (error.file !== null) return error;
  const target = error as { -readonly [K in "file" | "line" | "column"]: RexError[K] };
  target.file = location.file ?? null;
  target.line = location.file === undefined ? null : (location.line ?? null);
  target.column = location.file === undefined || location.line === undefined ? null : (location.column ?? null);
  return error;
}
