export const REX_ERRORS_DOCS_BASE = "https://rex.sidioralabs.com/errors";

export type RexErrorArea = "config" | "declaration";

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
