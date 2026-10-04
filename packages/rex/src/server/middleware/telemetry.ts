import type { Context, Hono, Next } from "hono";
import type { AnyAction } from "../../core/action.ts";
import type { RexLogger, TelemetryConfig } from "../../core/config.ts";
import { RexError } from "../../core/errors.ts";
import { parseRoute, type AnyPage } from "../../core/page.ts";
import type { RexServerSetup } from "../app.ts";
import type { Ledger } from "../audit.ts";

declare module "../app.ts" {
  interface RexServerOptions<A extends AnyAction> {
    readonly telemetry?: TelemetryConfig;
  }
}

declare module "hono" {
  interface ContextVariableMap {
    rexSpan: RexSpan;
  }
}

export const SPAN_ACTION = "rex.action";
export const SPAN_FORM = "rex.form";
export const SPAN_LOADER = "rex.loader";
export const SPAN_RENDER = "rex.render";

export type RexSpanName =
  typeof SPAN_ACTION | typeof SPAN_FORM | typeof SPAN_LOADER | typeof SPAN_RENDER;

export const ATTR_ACTION_ID = "rex.action.id";
export const ATTR_ACTOR_ID = "rex.actor.id";
export const ATTR_PAGE_ID = "rex.page.id";
export const ATTR_OUTCOME = "rex.outcome";

export const REX_PATH_PREFIX = "/rex/";
export const REX_FORM_PREFIX = "/rex/form";
export const OUTCOME_OK = "ok";
export const OUTCOME_ERROR = "ERROR";

const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;
const SERVER_FAULTS = new Set(["INTERNAL_SERVER_ERROR", OUTCOME_ERROR]);
const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
const INVALID_TRACE_ID = "0".repeat(32);
const INVALID_SPAN_ID = "0".repeat(16);

export type RexSpanAttributes = Readonly<Record<string, string | number | boolean>>;

export interface TelemetrySpanContext {
  readonly traceId: string;
  readonly spanId: string;
}

export interface TelemetrySpan {
  spanContext(): TelemetrySpanContext;
  setAttribute(key: string, value: string | number | boolean): unknown;
  setStatus(status: { code: number; message?: string }): unknown;
  recordException(exception: Error | string): unknown;
  end(): void;
}

export interface TelemetryTracer {
  startSpan(name: string, options?: { attributes?: RexSpanAttributes }): TelemetrySpan;
}

export interface RexSpan {
  readonly name: RexSpanName;
  readonly traceId: string | null;
  readonly spanId: string | null;
  set(attributes: RexSpanAttributes): void;
  outcome(outcome: string): void;
}

export interface RexTelemetry {
  readonly tracer: TelemetryTracer | null;
  readonly logger: RexLogger;
  span<T>(
    name: RexSpanName,
    attributes: RexSpanAttributes,
    run: (span: RexSpan) => Promise<T> | T,
  ): Promise<T>;
}

export interface ConsoleTarget {
  debug(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
}

export const LOG_PREFIX = "rex:";

export function createConsoleLogger(target: ConsoleTarget = console): RexLogger {
  const write =
    (level: keyof ConsoleTarget) =>
    (message: string, attributes?: Readonly<Record<string, unknown>>): void => {
      if (attributes === undefined) target[level](`${LOG_PREFIX} ${message}`);
      else target[level](`${LOG_PREFIX} ${message}`, attributes);
    };
  return Object.freeze({
    debug: write("debug"),
    info: write("info"),
    warn: write("warn"),
    error: write("error"),
  });
}

export const consoleLogger: RexLogger = createConsoleLogger();

export function isTelemetryTracer(value: unknown): value is TelemetryTracer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { startSpan?: unknown }).startSpan === "function"
  );
}

function validIds(span: TelemetrySpan): TelemetrySpanContext | null {
  const context = span.spanContext();
  if (
    typeof context !== "object" ||
    context === null ||
    !TRACE_ID.test(context.traceId) ||
    !SPAN_ID.test(context.spanId) ||
    context.traceId === INVALID_TRACE_ID ||
    context.spanId === INVALID_SPAN_ID
  ) {
    return null;
  }
  return context;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTelemetry(config: TelemetryConfig = {}): RexTelemetry {
  const tracerOption: unknown = config.tracer;
  if (tracerOption !== undefined && !isTelemetryTracer(tracerOption)) {
    throw new RexError(
      "REX400",
      "telemetry: tracer must be an OpenTelemetry tracer with startSpan",
    );
  }
  const tracer: TelemetryTracer | null = tracerOption === undefined ? null : tracerOption;
  const logger = config.logger ?? consoleLogger;

  async function span<T>(
    name: RexSpanName,
    attributes: RexSpanAttributes,
    run: (span: RexSpan) => Promise<T> | T,
  ): Promise<T> {
    const native =
      tracer === null ? null : tracer.startSpan(name, { attributes: { ...attributes } });
    const ids = native === null ? null : validIds(native);
    const recorded: Record<string, string | number | boolean> = { ...attributes };
    let outcome: string | null = null;
    const handle: RexSpan = Object.freeze({
      name,
      traceId: ids === null ? null : ids.traceId,
      spanId: ids === null ? null : ids.spanId,
      set(next: RexSpanAttributes) {
        for (const [key, value] of Object.entries(next)) {
          recorded[key] = value;
          native?.setAttribute(key, value);
        }
      },
      outcome(value: string) {
        outcome = value;
        handle.set({ [ATTR_OUTCOME]: value });
      },
    });
    let failure: unknown = null;
    let failed = false;
    try {
      return await run(handle);
    } catch (error) {
      failed = true;
      failure = error;
      throw error;
    } finally {
      if (outcome === null) handle.outcome(failed ? OUTCOME_ERROR : OUTCOME_OK);
      const final = outcome ?? OUTCOME_OK;
      if (native !== null) {
        if (failed) {
          native.recordException(failure instanceof Error ? failure : String(failure));
        }
        if (final === OUTCOME_OK) native.setStatus({ code: SPAN_STATUS_OK });
        else native.setStatus({ code: SPAN_STATUS_ERROR, message: final });
        native.end();
      }
      if (SERVER_FAULTS.has(final) || /^HTTP_5\d\d$/.test(final)) {
        logger.error(
          `${name} failed`,
          failed ? { ...recorded, error: errorText(failure) } : { ...recorded },
        );
      }
    }
  }

  return Object.freeze({ tracer, logger, span });
}

const DEFAULT_TELEMETRY: RexTelemetry = createTelemetry();
const BOUND = new WeakMap<Ledger, RexTelemetry>();

export function bindTelemetry(ledger: Ledger, telemetry: RexTelemetry): void {
  BOUND.set(ledger, telemetry);
}

export function telemetryFor(ledger: Ledger): RexTelemetry {
  return BOUND.get(ledger) ?? DEFAULT_TELEMETRY;
}

interface RouteMatcher {
  readonly page: AnyPage;
  readonly statics: readonly (string | null)[];
  readonly weight: number;
}

function compileMatchers(pages: readonly AnyPage[]): readonly RouteMatcher[] {
  return pages
    .map((page) => {
      const statics = parseRoute(page.route).segments.map((segment) =>
        segment.kind === "static" ? segment.value : null,
      );
      return { page, statics, weight: statics.filter((value) => value !== null).length };
    })
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        (a.page.route < b.page.route ? -1 : a.page.route > b.page.route ? 1 : 0),
    );
}

export function matchPagePath(matchers: readonly RouteMatcher[], path: string): AnyPage | null {
  const parts = path === "/" ? [] : path.slice(1).split("/");
  for (const matcher of matchers) {
    if (matcher.statics.length !== parts.length) continue;
    const matched = matcher.statics.every((value, index) => {
      const part = parts[index] as string;
      return value === null ? part.length > 0 : value === part;
    });
    if (matched) return matcher.page;
  }
  return null;
}

function responseOutcome(c: Context): string {
  return c.res.status < 400 ? OUTCOME_OK : `HTTP_${c.res.status}`;
}

async function traced(
  telemetry: RexTelemetry,
  name: RexSpanName,
  attributes: RexSpanAttributes,
  c: Context,
  next: Next,
): Promise<void> {
  await telemetry.span(name, attributes, async (span) => {
    let settled = false;
    const own = span.outcome;
    const tracking: RexSpan = Object.freeze({
      name: span.name,
      traceId: span.traceId,
      spanId: span.spanId,
      set: span.set,
      outcome(value: string) {
        settled = true;
        own(value);
      },
    });
    c.set("rexSpan", tracking);
    await next();
    if (!settled) own(responseOutcome(c));
  });
}

export function installTelemetry(app: Hono, setup: RexServerSetup): void {
  const telemetry = createTelemetry(setup.options.telemetry);
  bindTelemetry(setup.options.ledger, telemetry);
  const matchers = compileMatchers(setup.options.registry.pages);
  app.use("*", async (c, next) => {
    const path = c.req.path;
    if (c.req.method === "POST" && path.startsWith(`${REX_FORM_PREFIX}/`)) {
      const actionId = decodeURIComponent(path.slice(REX_FORM_PREFIX.length + 1));
      await traced(telemetry, SPAN_FORM, { [ATTR_ACTION_ID]: actionId }, c, next);
      return;
    }
    if ((c.req.method === "GET" || c.req.method === "HEAD") && !path.startsWith(REX_PATH_PREFIX)) {
      const page = matchPagePath(matchers, path);
      if (page !== null) {
        await traced(telemetry, SPAN_RENDER, { [ATTR_PAGE_ID]: page.id }, c, next);
        return;
      }
    }
    await next();
  });
}

export async function traceLoader<T>(
  telemetry: RexTelemetry,
  attributes: { readonly pageId: string; readonly actionId: string; readonly actorId: string },
  run: (span: RexSpan) => Promise<T> | T,
): Promise<T> {
  return telemetry.span(
    SPAN_LOADER,
    {
      [ATTR_PAGE_ID]: attributes.pageId,
      [ATTR_ACTION_ID]: attributes.actionId,
      [ATTR_ACTOR_ID]: attributes.actorId,
    },
    run,
  );
}
