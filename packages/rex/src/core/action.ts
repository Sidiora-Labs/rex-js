import type { Actor } from "./actor.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { isValidName } from "./ids.ts";
import { isPredicate, type Predicate } from "./policy.ts";
import { toJsonSchema, z, type JsonSchema } from "./schema.ts";

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

export interface ActionContext {
  readonly actor: Actor;
}

export interface ActionConfig<I extends z.ZodType, O extends z.ZodType> {
  readonly input: I;
  readonly output: O;
  readonly policy: Predicate;
  readonly effect: ActionEffect;
  readonly label?: string;
  readonly shortcut?: string;
  readonly invalidates?: readonly string[];
  readonly handler: (input: z.output<I>, ctx: ActionContext) => z.input<O> | Promise<z.input<O>>;
}

export interface ActionDeclaration<
  N extends string = string,
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
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
  readonly inputJsonSchema: JsonSchema;
  readonly outputJsonSchema: JsonSchema;
  handler(input: z.output<I>, ctx: ActionContext): z.input<O> | Promise<z.input<O>>;
}

export type AnyAction = ActionDeclaration<string, z.ZodType, z.ZodType>;

export type ActionInput<A> =
  A extends ActionDeclaration<string, infer I, z.ZodType> ? z.input<I> : never;
export type ActionParsedInput<A> =
  A extends ActionDeclaration<string, infer I, z.ZodType> ? z.output<I> : never;
export type ActionOutput<A> =
  A extends ActionDeclaration<string, z.ZodType, infer O> ? z.output<O> : never;

const ACTION_KEYS = new Set([
  "input",
  "output",
  "policy",
  "effect",
  "label",
  "shortcut",
  "invalidates",
  "handler",
]);

export function action<const N extends string, I extends z.ZodType, O extends z.ZodType>(
  name: N,
  config: ActionConfig<I, O>,
): ActionDeclaration<N, I, O> {
  const id = declarationName("action", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("action", id, field, problem);
  };

  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (!ACTION_KEYS.has(property)) fail(property, "is not part of the action declaration");
  }
  if (!(config.input instanceof z.ZodType)) fail("input", "must be a zod schema");
  if (!(config.output instanceof z.ZodType)) fail("output", "must be a zod schema");
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

  let inputJsonSchema: JsonSchema = {};
  let outputJsonSchema: JsonSchema = {};
  try {
    inputJsonSchema = toJsonSchema(config.input, "input");
  } catch (error) {
    fail("input", `cannot be represented as JSON Schema: ${(error as Error).message}`);
  }
  try {
    outputJsonSchema = toJsonSchema(config.output, "output");
  } catch (error) {
    fail("output", `cannot be represented as JSON Schema: ${(error as Error).message}`);
  }

  const handler = config.handler;
  return Object.freeze({
    kind: "action",
    id,
    name: id,
    input: config.input,
    output: config.output,
    policy: config.policy,
    effect: config.effect,
    label: config.label ?? null,
    shortcut: config.shortcut ?? null,
    invalidates: Object.freeze([...new Set(invalidates)]),
    inputJsonSchema: Object.freeze(inputJsonSchema),
    outputJsonSchema: Object.freeze(outputJsonSchema),
    handler(input: z.output<I>, ctx: ActionContext) {
      return handler(input, ctx);
    },
  });
}
