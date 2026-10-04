import type { Actor } from "./actor.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { RexDeclarationOptionError, RexError, errorDetail } from "./errors.ts";
import { isValidName } from "./ids.ts";
import { isPredicate, type Predicate } from "./policy.ts";
import { DEFAULT_DENSITY, REX_RPC_PREFIX, isRexDensity, type RexDensity } from "./protocol.ts";
import type { JsonSchema } from "./schema.ts";
import {
  isStandardSchema,
  type StandardInferInput,
  type StandardInferOutput,
  type StandardSchemaV1,
} from "./standard.ts";

export type ActionEffect = "reversible" | "irreversible" | "read";

export const ACTION_EFFECTS: readonly ActionEffect[] = ["reversible", "irreversible", "read"];

export const SHORTCUT_MODIFIERS = ["mod", "shift", "alt"] as const;

export type ShortcutModifier = (typeof SHORTCUT_MODIFIERS)[number];

export const RESERVED_SHORTCUTS: readonly string[] = ["mod+k", "escape"];

const NAMED_KEYS = new Set([
  "enter",
  "escape",
  "space",
  "tab",
  "backspace",
  "delete",
  "home",
  "end",
  "pageup",
  "pagedown",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
]);
const PUNCTUATION_KEYS = new Set(["/", ".", ",", ";", "'", "[", "]", "-", "=", "`", "\\"]);

export interface ParsedShortcut {
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly key: string;
}

export function parseShortcut(shortcut: string): ParsedShortcut {
  if (typeof shortcut !== "string" || shortcut.length === 0) {
    throw new RexError("REX219", "shortcut must be a non-empty string");
  }
  const parts = shortcut === "+" ? ["+"] : shortcut.split("+");
  const key = parts.pop() as string;
  const seen = new Set<string>();
  let previous = -1;
  for (const part of parts) {
    const index = (SHORTCUT_MODIFIERS as readonly string[]).indexOf(part);
    if (index === -1) {
      throw new RexError(
        "REX219",
        `"${part}" is not a modifier; use ${SHORTCUT_MODIFIERS.join(", ")}`,
      );
    }
    if (seen.has(part)) throw new RexError("REX219", `modifier "${part}" is repeated`);
    if (index < previous) {
      throw new RexError("REX219", `modifiers must be ordered ${SHORTCUT_MODIFIERS.join("+")}`);
    }
    seen.add(part);
    previous = index;
  }
  if (!(/^[a-z0-9]$/.test(key) || NAMED_KEYS.has(key) || PUNCTUATION_KEYS.has(key))) {
    throw new RexError(
      "REX219",
      `"${key}" is not a key; use one lowercase letter, digit, punctuation key or named key`,
    );
  }
  return Object.freeze({
    mod: seen.has("mod"),
    shift: seen.has("shift"),
    alt: seen.has("alt"),
    key,
  });
}

export function validateShortcut(shortcut: string): string {
  parseShortcut(shortcut);
  if (RESERVED_SHORTCUTS.includes(shortcut)) {
    throw new RexError("REX219", `"${shortcut}" is reserved by Rex`);
  }
  return shortcut;
}

export interface ActionFormConfig {
  readonly redirect?: string;
  readonly confirmTitle?: string;
}

export interface ActionForm {
  readonly redirect: string | null;
  readonly confirmTitle: string | null;
}

export interface ActionJsonSchemaConfig {
  readonly input?: JsonSchema;
  readonly output?: JsonSchema;
}

export interface ActionJsonSchema {
  readonly input: JsonSchema | null;
  readonly output: JsonSchema | null;
}

export interface RexServerEnv {
  readonly [key: string]: unknown;
}

export interface ActionContext {
  readonly actor: Actor;
  readonly env: RexServerEnv | null;
  readonly locale: string | null;
  readonly density: RexDensity;
}

export interface ActionInvocation {
  readonly actor: Actor;
  readonly env?: RexServerEnv | null;
  readonly locale?: string | null;
  readonly density?: RexDensity;
}

export const ACTION_HTTP_METHODS = ["GET", "POST"] as const;

export type ActionHttpMethod = (typeof ACTION_HTTP_METHODS)[number];

export interface ActionHttpConfig {
  readonly method: ActionHttpMethod;
  readonly path: string;
  readonly contentType?: string;
  readonly csrf?: boolean;
}

export interface ActionHttp {
  readonly method: ActionHttpMethod;
  readonly path: string;
  readonly contentType: string | null;
  readonly csrf: boolean;
}

export const ACTION_CACHE_SCOPES = ["shared", "actor", "locale"] as const;

export type ActionCacheScope = (typeof ACTION_CACHE_SCOPES)[number];

export const DEFAULT_ACTION_CACHE_SCOPE: ActionCacheScope = "actor";

export interface ActionCacheConfig {
  readonly maxAge: number;
  readonly scope?: ActionCacheScope;
}

export interface ActionCache {
  readonly maxAge: number;
  readonly scope: ActionCacheScope;
}

export type OptimisticUpdate<In = unknown> = (current: unknown, input: In) => unknown;

export type ActionOptimistic<In = unknown> = Readonly<Record<string, OptimisticUpdate<In>>>;

const HTTP_PATH_SEGMENT = /^[A-Za-z0-9._~-]+$/;
const CONTENT_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;.*)?$/i;
const REX_PATH_PREFIX = REX_RPC_PREFIX.slice(0, REX_RPC_PREFIX.indexOf("/", 1));

export function httpPathProblem(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    return "must be a path starting with /";
  }
  if (path === REX_PATH_PREFIX || path.startsWith(`${REX_PATH_PREFIX}/`)) {
    return `must not be under ${REX_PATH_PREFIX}, which Rex reserves`;
  }
  if (path === "/") return "must name a resource, not the site root";
  for (const segment of path.slice(1).split("/")) {
    if (!HTTP_PATH_SEGMENT.test(segment) || segment === "." || segment === "..") {
      return `segment "${segment}" must be letters, digits, dot, dash, underscore or tilde`;
    }
  }
  return null;
}

export interface ActionConfig<I extends StandardSchemaV1, O extends StandardSchemaV1> {
  readonly input: I;
  readonly output: O;
  readonly policy: Predicate;
  readonly effect: ActionEffect;
  readonly label?: string;
  readonly shortcut?: string;
  readonly invalidates?: readonly string[];
  readonly form?: ActionFormConfig;
  readonly jsonSchema?: ActionJsonSchemaConfig;
  readonly http?: ActionHttpConfig;
  readonly cache?: ActionCacheConfig;
  readonly optimistic?: ActionOptimistic<StandardInferOutput<I>>;
  readonly handler: (
    input: StandardInferOutput<I>,
    ctx: ActionContext,
  ) => StandardInferInput<O> | Promise<StandardInferInput<O>>;
}

export interface ActionDeclaration<
  N extends string = string,
  I extends StandardSchemaV1 = StandardSchemaV1,
  O extends StandardSchemaV1 = StandardSchemaV1,
> {
  readonly kind: "action";
  readonly id: N;
  readonly name: N;
  readonly input: I;
  readonly output: O;
  readonly policy: Predicate;
  readonly effect: ActionEffect;
  readonly label: string | null;
  readonly shortcut: string | null;
  readonly invalidates: readonly string[];
  readonly form: ActionForm | null;
  readonly jsonSchema: ActionJsonSchema | null;
  readonly http: ActionHttp | null;
  readonly cache: ActionCache | null;
  readonly optimistic: ActionOptimistic | null;
  handler(
    input: StandardInferOutput<I>,
    ctx: ActionInvocation,
  ): StandardInferInput<O> | Promise<StandardInferInput<O>>;
}

export type AnyAction = ActionDeclaration<string, StandardSchemaV1, StandardSchemaV1>;

export type ActionInput<A> =
  A extends ActionDeclaration<string, infer I, StandardSchemaV1> ? StandardInferInput<I> : never;
export type ActionParsedInput<A> =
  A extends ActionDeclaration<string, infer I, StandardSchemaV1> ? StandardInferOutput<I> : never;
export type ActionOutput<A> =
  A extends ActionDeclaration<string, StandardSchemaV1, infer O> ? StandardInferOutput<O> : never;

const ACTION_KEYS = new Set([
  "input",
  "output",
  "policy",
  "effect",
  "label",
  "shortcut",
  "invalidates",
  "form",
  "jsonSchema",
  "http",
  "cache",
  "optimistic",
  "handler",
]);
const FORM_KEYS = new Set(["redirect", "confirmTitle"]);
const HTTP_KEYS = new Set(["method", "path", "contentType", "csrf"]);
const CACHE_KEYS = new Set(["maxAge", "scope"]);

export function actionContext(invocation: ActionInvocation): ActionContext {
  const density = invocation.density ?? DEFAULT_DENSITY;
  if (!isRexDensity(density)) {
    throw new RexError(
      "REX321",
      `action context density "${String(density)}" is not a Rex density`,
    );
  }
  return Object.freeze({
    actor: invocation.actor,
    env: invocation.env ?? null,
    locale: invocation.locale ?? null,
    density,
  });
}
const JSON_SCHEMA_KEYS = new Set(["input", "output"]);

export function action<
  const N extends string,
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
>(name: N, config: ActionConfig<I, O>): ActionDeclaration<N, I, O> {
  const id = declarationName("action", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("action", id, field, problem);
  };
  const reject = (
    code: "REX207" | "REX208" | "REX227" | "REX228" | "REX229",
    field: string,
    problem: string,
  ): never => {
    throw new RexDeclarationOptionError(code, { declaration: "action", id, field, problem });
  };

  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (!ACTION_KEYS.has(property)) fail(property, "is not part of the action declaration");
  }
  if (!isStandardSchema(config.input))
    fail("input", "must be a Standard Schema such as a zod schema");
  if (!isStandardSchema(config.output)) {
    fail("output", "must be a Standard Schema such as a zod schema");
  }
  const input = config.input;
  const output = config.output;
  if (!isPredicate(config.policy)) fail("policy", "must be a policy predicate");
  if (!ACTION_EFFECTS.includes(config.effect)) {
    fail("effect", `must be one of ${ACTION_EFFECTS.join(", ")}`);
  }
  if (
    config.label !== undefined &&
    (typeof config.label !== "string" || config.label.trim() === "")
  ) {
    fail("label", "must be a non-empty string");
  }
  if (config.shortcut !== undefined) {
    try {
      validateShortcut(config.shortcut);
    } catch (error) {
      fail("shortcut", errorDetail(error));
    }
  }
  const invalidates = config.invalidates ?? [];
  if (!Array.isArray(invalidates)) fail("invalidates", "must be a list of names");
  for (const [index, target] of invalidates.entries()) {
    if (!isValidName(target))
      fail(`invalidates.${index}`, `"${String(target)}" is not a valid name`);
  }
  if (typeof config.handler !== "function") fail("handler", "must be a function");

  let form: ActionForm | null = null;
  if (config.form !== undefined) {
    if (!isPlainObject(config.form as unknown)) reject("REX207", "form", "must be an object");
    for (const property of Object.keys(config.form)) {
      if (!FORM_KEYS.has(property)) {
        reject("REX207", `form.${property}`, "is not one of redirect, confirmTitle");
      }
    }
    const { redirect, confirmTitle } = config.form;
    if (
      redirect !== undefined &&
      (typeof redirect !== "string" || !redirect.startsWith("/") || redirect.startsWith("//"))
    ) {
      reject("REX207", "form.redirect", "must be a path on this origin starting with /");
    }
    if (
      confirmTitle !== undefined &&
      (typeof confirmTitle !== "string" || confirmTitle.trim() === "")
    ) {
      reject("REX207", "form.confirmTitle", "must be a non-empty string");
    }
    form = Object.freeze({ redirect: redirect ?? null, confirmTitle: confirmTitle ?? null });
  }

  let jsonSchema: ActionJsonSchema | null = null;
  if (config.jsonSchema !== undefined) {
    if (!isPlainObject(config.jsonSchema as unknown)) {
      reject("REX208", "jsonSchema", "must be an object with input and output schemas");
    }
    for (const property of Object.keys(config.jsonSchema)) {
      if (!JSON_SCHEMA_KEYS.has(property)) {
        reject("REX208", `jsonSchema.${property}`, "is not one of input, output");
      }
    }
    for (const side of ["input", "output"] as const) {
      const declared = config.jsonSchema[side];
      if (declared !== undefined && !isPlainObject(declared as unknown)) {
        reject("REX208", `jsonSchema.${side}`, "must be a JSON Schema object");
      }
    }
    jsonSchema = Object.freeze({
      input:
        config.jsonSchema.input === undefined
          ? null
          : Object.freeze({ ...config.jsonSchema.input }),
      output:
        config.jsonSchema.output === undefined
          ? null
          : Object.freeze({ ...config.jsonSchema.output }),
    });
  }

  let http: ActionHttp | null = null;
  if (config.http !== undefined) {
    if (!isPlainObject(config.http as unknown)) reject("REX227", "http", "must be an object");
    for (const property of Object.keys(config.http)) {
      if (!HTTP_KEYS.has(property)) {
        reject("REX227", `http.${property}`, "is not one of method, path, contentType, csrf");
      }
    }
    const { method, path, contentType, csrf } = config.http;
    if (!(ACTION_HTTP_METHODS as readonly unknown[]).includes(method)) {
      reject("REX227", "http.method", `must be one of ${ACTION_HTTP_METHODS.join(", ")}`);
    }
    if (method === "GET" && config.effect !== "read") {
      reject("REX227", "http.method", "GET is only allowed on a read action");
    }
    const pathProblem = httpPathProblem(path);
    if (pathProblem !== null) reject("REX227", "http.path", pathProblem);
    if (
      contentType !== undefined &&
      (typeof contentType !== "string" || !CONTENT_TYPE.test(contentType))
    ) {
      reject("REX227", "http.contentType", "must be a media type such as application/xml");
    }
    if (csrf !== undefined) {
      if (typeof csrf !== "boolean") reject("REX227", "http.csrf", "must be true or false");
      if (method !== "POST") reject("REX227", "http.csrf", "only applies to a POST endpoint");
    }
    http = Object.freeze({
      method,
      path,
      contentType: contentType ?? null,
      csrf: csrf ?? true,
    });
  }

  let cache: ActionCache | null = null;
  if (config.cache !== undefined) {
    if (config.effect !== "read") reject("REX228", "cache", "is only allowed on a read action");
    if (!isPlainObject(config.cache as unknown)) reject("REX228", "cache", "must be an object");
    for (const property of Object.keys(config.cache)) {
      if (!CACHE_KEYS.has(property)) {
        reject("REX228", `cache.${property}`, "is not one of maxAge, scope");
      }
    }
    const { maxAge, scope } = config.cache;
    if (!Number.isInteger(maxAge) || maxAge <= 0) {
      reject("REX228", "cache.maxAge", "must be a positive whole number of seconds");
    }
    if (scope !== undefined && !(ACTION_CACHE_SCOPES as readonly unknown[]).includes(scope)) {
      reject("REX228", "cache.scope", `must be one of ${ACTION_CACHE_SCOPES.join(", ")}`);
    }
    cache = Object.freeze({ maxAge, scope: scope ?? DEFAULT_ACTION_CACHE_SCOPE });
  }

  let optimistic: ActionOptimistic | null = null;
  if (config.optimistic !== undefined) {
    if (config.effect === "read") {
      reject("REX229", "optimistic", "is only allowed on a mutating action");
    }
    if (!isPlainObject(config.optimistic as unknown)) {
      reject("REX229", "optimistic", "must map invalidated names to update functions");
    }
    const updates: Record<string, OptimisticUpdate> = {};
    for (const [name, update] of Object.entries(config.optimistic)) {
      if (!invalidates.includes(name)) {
        reject("REX229", `optimistic.${name}`, `names "${name}", which invalidates does not list`);
      }
      if (typeof update !== "function") {
        reject("REX229", `optimistic.${name}`, "must be a function (current, input) => next");
      }
      updates[name] = update as OptimisticUpdate;
    }
    optimistic = Object.freeze(updates);
  }

  const handler = config.handler;
  return Object.freeze({
    kind: "action",
    id,
    name: id,
    input,
    output,
    policy: config.policy,
    effect: config.effect,
    label: config.label ?? null,
    shortcut: config.shortcut ?? null,
    invalidates: Object.freeze([...new Set(invalidates)]),
    form,
    jsonSchema,
    http,
    cache,
    optimistic,
    handler(value: StandardInferOutput<I>, ctx: ActionInvocation) {
      return handler(value, actionContext(ctx));
    },
  });
}
