import type { Actor } from "./actor.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { RexDeclarationOptionError } from "./errors.ts";
import { isValidName } from "./ids.ts";
import { isPredicate, type Predicate } from "./policy.ts";
import { toJsonSchema, type JsonSchema, type z } from "./schema.ts";
import {
  fromStandard,
  isStandardSchema,
  standardSource,
  type AsZodSchema,
  type StandardInferInput,
  type StandardInferOutput,
  type StandardSchemaV1,
  type ZodSchemaLike,
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
    throw new Error("shortcut must be a non-empty string");
  }
  const parts = shortcut === "+" ? ["+"] : shortcut.split("+");
  const key = parts.pop() as string;
  const seen = new Set<string>();
  let previous = -1;
  for (const part of parts) {
    const index = (SHORTCUT_MODIFIERS as readonly string[]).indexOf(part);
    if (index === -1) {
      throw new Error(`"${part}" is not a modifier; use ${SHORTCUT_MODIFIERS.join(", ")}`);
    }
    if (seen.has(part)) throw new Error(`modifier "${part}" is repeated`);
    if (index < previous) {
      throw new Error(`modifiers must be ordered ${SHORTCUT_MODIFIERS.join("+")}`);
    }
    seen.add(part);
    previous = index;
  }
  if (!(/^[a-z0-9]$/.test(key) || NAMED_KEYS.has(key) || PUNCTUATION_KEYS.has(key))) {
    throw new Error(
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
    throw new Error(`"${shortcut}" is reserved by Rex`);
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

export interface ActionContext {
  readonly actor: Actor;
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
  readonly handler: (
    input: StandardInferOutput<I>,
    ctx: ActionContext,
  ) => StandardInferInput<O> | Promise<StandardInferInput<O>>;
}

export interface ActionDeclaration<
  N extends string = string,
  I extends ZodSchemaLike = ZodSchemaLike,
  O extends ZodSchemaLike = ZodSchemaLike,
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
  readonly inputJsonSchema: JsonSchema;
  readonly outputJsonSchema: JsonSchema;
  handler(input: z.output<I>, ctx: ActionContext): z.input<O> | Promise<z.input<O>>;
}

export type AnyAction = ActionDeclaration<string, ZodSchemaLike, ZodSchemaLike>;

export type ActionInput<A> =
  A extends ActionDeclaration<string, infer I, ZodSchemaLike> ? z.input<I> : never;
export type ActionParsedInput<A> =
  A extends ActionDeclaration<string, infer I, ZodSchemaLike> ? z.output<I> : never;
export type ActionOutput<A> =
  A extends ActionDeclaration<string, ZodSchemaLike, infer O> ? z.output<O> : never;

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
  "handler",
]);
const FORM_KEYS = new Set(["redirect", "confirmTitle"]);
const JSON_SCHEMA_KEYS = new Set(["input", "output"]);

export function action<
  const N extends string,
  I extends StandardSchemaV1,
  O extends StandardSchemaV1,
>(
  name: N,
  config: ActionConfig<I, O>,
): ActionDeclaration<N, AsZodSchema<I>, AsZodSchema<O>> {
  const id = declarationName("action", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("action", id, field, problem);
  };
  const reject = (code: "REX207" | "REX208", field: string, problem: string): never => {
    throw new RexDeclarationOptionError(code, { declaration: "action", id, field, problem });
  };

  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (!ACTION_KEYS.has(property)) fail(property, "is not part of the action declaration");
  }
  if (!isStandardSchema(config.input)) fail("input", "must be a Standard Schema such as a zod schema");
  if (!isStandardSchema(config.output)) {
    fail("output", "must be a Standard Schema such as a zod schema");
  }
  const input = fromStandard(config.input);
  const output = fromStandard(config.output);
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
      fail("shortcut", (error as Error).message);
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
      input: config.jsonSchema.input === undefined ? null : Object.freeze({ ...config.jsonSchema.input }),
      output:
        config.jsonSchema.output === undefined ? null : Object.freeze({ ...config.jsonSchema.output }),
    });
  }

  let inputJsonSchema: JsonSchema = {};
  let outputJsonSchema: JsonSchema = {};
  if (jsonSchema?.input != null) {
    inputJsonSchema = jsonSchema.input;
  } else if (standardSource(input) === null) {
    try {
      inputJsonSchema = toJsonSchema(input, "input");
    } catch (error) {
      fail("input", `cannot be represented as JSON Schema: ${(error as Error).message}`);
    }
  }
  if (jsonSchema?.output != null) {
    outputJsonSchema = jsonSchema.output;
  } else if (standardSource(output) === null) {
    try {
      outputJsonSchema = toJsonSchema(output, "output");
    } catch (error) {
      fail("output", `cannot be represented as JSON Schema: ${(error as Error).message}`);
    }
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
    inputJsonSchema: Object.freeze(inputJsonSchema),
    outputJsonSchema: Object.freeze(outputJsonSchema),
    handler(value: z.output<AsZodSchema<I>>, ctx: ActionContext) {
      return handler(value as StandardInferOutput<I>, ctx) as
        | z.input<AsZodSchema<O>>
        | Promise<z.input<AsZodSchema<O>>>;
    },
  });
}
