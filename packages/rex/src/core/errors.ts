export const REX_ERRORS_DOCS_BASE = "https://rex.sidioralabs.com/errors";

export const REX_ERROR_CATALOG = {
  REX100: "rex.config.ts is missing",
  REX101: "rex.config.ts default-exports a bare Hono app",
  REX102: "rex.config.ts default export is not a Rex config",
  REX110: "Unknown config field",
  REX111: "Invalid config app",
  REX112: "Invalid config server",
  REX113: "Invalid config render",
  REX114: "Invalid config budgets",
  REX115: "Invalid config security",
  REX116: "Invalid config i18n",
  REX117: "Invalid config images",
  REX118: "Invalid config fonts",
  REX119: "Invalid config telemetry",
  REX120: "Invalid config ui",
  REX121: "Invalid config client",
  REX122: "Invalid config flag",
  REX123: "Invalid config check",
  REX200: "Invalid page render mode",
  REX201: "Invalid page revalidate",
  REX202: "Invalid page paths",
  REX203: "Invalid page loader",
  REX204: "Invalid page cache",
  REX205: "Invalid page transition",
  REX206: "Invalid page chrome components",
  REX207: "Invalid action form options",
  REX208: "Invalid action JSON Schema override",
  REX209: "Page loader names an unregistered action",
  REX210: "Schema cannot be represented as JSON Schema",
  REX211: "Invalid entity declaration",
  REX212: "Invalid action declaration",
  REX213: "Invalid page declaration",
  REX214: "Invalid policy declaration",
  REX215: "Invalid policy predicate",
  REX216: "Invalid flow declaration",
  REX217: "Duplicate declaration id",
  REX218: "Invalid name",
  REX219: "Invalid action shortcut",
  REX220: "Invalid page route",
  REX221: "Duplicate enum value",
  REX222: "Page names an unregistered action",
  REX223: "Page names an unknown page",
  REX224: "Registered value is not a complete declaration",
  REX300: "Schema validates asynchronously",
  REX301: "Unknown declaration",
  REX302: "Invalid journal id",
  REX303: "Unknown flow instance",
  REX304: "Flow instance belongs to another flow",
  REX305: "Unknown store filter field",
  REX306: "Rendered outside its Rex provider",
  REX307: "Not declared by the page",
  REX308: "Declaration missing from the manifest or router",
  REX309: "Unexpected server response",
  REX310: "Hydration mismatch",
  REX311: "Invalid startup data",
  REX312: "Invalid rex data script",
  REX313: "Invalid page modules",
  REX314: "Invalid component props",
  REX315: "Invalid store",
  REX316: "Invalid i18n setup",
  REX317: "Invalid message pattern",
  REX318: "Sidecar conflict",
  REX319: "Invalid custom element",
  REX320: "Page declaration changed",
  REX321: "Invalid density",
  REX322: "Invalid outcome",
  REX323: "No http(s) base URL",
  REX324: "Loader produced no result",
  REX325: "Invalid page draft",
  REX326: "Script failed to load",
  REX327: "Browser API unavailable",
  REX328: "Invalid devtools input",
  REX329: "Invalid Rex API argument",
  REX330: "Region failed to render",
  REX331: "Invalid page params",
  REX332: "Value rejected by its schema",
  REX333: "Flow has no pending approval",
  REX334: "Actor may not decide the approval gate",
  REX400: "Invalid server option",
  REX401: "Duplicate or reserved procedure id",
  REX402: "Invalid audit entry",
  REX403: "Invalid audit filter",
  REX404: "Invalid prerender list or page path",
  REX405: "Static page cannot be generated",
  REX406: "Client directory missing",
  REX407: "Invalid port",
  REX408: "Page loaders need createRexServer",
  REX440: "Server-only module imported by client code",
  REX441: "Secret referenced by client code",
  REX442: "Action handler called in the browser",
  REX450: "Runtime not available for the adapter",
  REX460: "App folder layout is invalid",
  REX461: "Invalid Vite client manifest",
  REX462: "Invalid rex:app module",
  REX463: "Root element missing",
  REX500: "Manifest scan failed",
  REX501: "Invalid manifest build option",
  REX502: "Manifest value cannot be serialised",
  REX503: "Invalid checker rule",
  REX504: "Invalid finding",
  REX505: "Checker rule failed",
  REX506: "Unknown report format",
  REX507: "Runtime check failed",
  REX508: "Config value is not static",
  REX509: "Raw element where the DesignX kit has a primitive",
  REX510: "Pixel size on a part",
  REX511: "Control under the 44 px touch target",
  REX600: "Invalid CLI command definition",
  REX601: "Invalid generator argument",
  REX602: "Generator refused to write",
  REX603: "Template dependency not pinned",
  REX604: "Invalid command line",
  REX605: "Command refused",
  REX610: "Codemod left a placeholder",
  REX611: "Unknown migration source",
  REX612: "Invalid codemod module",
} as const satisfies Readonly<Record<string, string>>;

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
  readonly hint: string | null;
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
    this.hint = options.hint ?? null;
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

export function formatRexError(error: RexError, hint: string | null = error.hint): string {
  const location =
    error.file === null
      ? ""
      : ` (${error.file}${error.line === null ? "" : `:${error.line}${error.column === null ? "" : `:${error.column}`}`})`;
  const help = hint === null ? "" : `\n  hint: ${hint}`;
  return `${error.message}${location}${help}\n  docs: ${error.docs}`;
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
