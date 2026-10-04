import { $ZodType } from "zod/v4/core";
import * as zm from "zod/mini";
import type { z } from "zod";
import { RexError } from "./errors.ts";

export interface StandardPathSegment {
  readonly key: PropertyKey;
}

export interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | StandardPathSegment> | undefined;
}

export interface StandardSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardFailure {
  readonly issues: ReadonlyArray<StandardIssue>;
}

export type StandardResult<Output> = StandardSuccess<Output> | StandardFailure;

export interface StandardTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

export interface StandardProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (
    value: unknown,
  ) => StandardResult<Output> | Promise<StandardResult<Output>>;
  readonly types?: StandardTypes<Input, Output> | undefined;
}

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardProps<Input, Output>;
}

export type StandardInferInput<S extends StandardSchemaV1> = NonNullable<
  S["~standard"]["types"]
>["input"];

export type StandardInferOutput<S extends StandardSchemaV1> = NonNullable<
  S["~standard"]["types"]
>["output"];

export type ZodSchemaLike = z.ZodType | zm.ZodMiniType;

export type AsZodSchema<S extends StandardSchemaV1> = S extends ZodSchemaLike
  ? S
  : zm.ZodMiniType<StandardInferOutput<S>, StandardInferInput<S>>;

export class StandardValidationError extends RexError {
  readonly issues: readonly StandardIssue[];

  constructor(issues: readonly StandardIssue[]) {
    super("REX332", formatIssues(issues));
    this.name = "StandardValidationError";
    this.issues = issues;
  }
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) return false;
  const props = (value as { "~standard"?: unknown })["~standard"];
  return (
    typeof props === "object" &&
    props !== null &&
    (props as { version?: unknown }).version === 1 &&
    typeof (props as { vendor?: unknown }).vendor === "string" &&
    typeof (props as { validate?: unknown }).validate === "function"
  );
}

export function isZodSchema(value: unknown): value is ZodSchemaLike {
  return value instanceof $ZodType;
}

export function issuePath(issue: StandardIssue): string {
  return (issue.path ?? [])
    .map((segment) =>
      typeof segment === "object" && segment !== null ? String(segment.key) : String(segment),
    )
    .join(".");
}

export function formatIssues(issues: readonly StandardIssue[], subject = "input"): string {
  return issues.map((issue) => `${issuePath(issue) || subject} ${issue.message}`).join("; ");
}

export async function validateStandard<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): Promise<StandardResult<StandardInferOutput<S>>> {
  return (await schema["~standard"].validate(value)) as StandardResult<StandardInferOutput<S>>;
}

export function validateStandardSync<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): StandardResult<StandardInferOutput<S>> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) {
    throw new RexError(
      "REX300",
      `the ${schema["~standard"].vendor} schema validates asynchronously; validate it with validateStandard`,
    );
  }
  return result as StandardResult<StandardInferOutput<S>>;
}

const sources = new WeakMap<object, StandardSchemaV1>();

function issueKeys(issue: StandardIssue): PropertyKey[] {
  return (issue.path ?? []).map((segment) =>
    typeof segment === "object" && segment !== null ? segment.key : segment,
  );
}

export function fromStandard<S extends StandardSchemaV1>(schema: S): AsZodSchema<S> {
  if (isZodSchema(schema)) return schema as AsZodSchema<S>;
  if (!isStandardSchema(schema)) {
    throw new RexError("REX329", "fromStandard: the value does not implement the Standard Schema v1 interface");
  }
  const adapter = zm.pipe(
    zm.unknown(),
    zm.transform((value, ctx) => {
      const settle = (result: StandardResult<unknown>) => {
        if (result.issues === undefined) return result.value;
        for (const issue of result.issues) {
          ctx.issues.push({
            code: "custom",
            message: issue.message,
            input: value,
            path: issueKeys(issue),
          });
        }
        return zm.NEVER;
      };
      const result = schema["~standard"].validate(value);
      return result instanceof Promise ? result.then(settle) : settle(result);
    }),
  );
  sources.set(adapter, schema);
  return adapter as unknown as AsZodSchema<S>;
}

export function standardSource(schema: unknown): StandardSchemaV1 | null {
  if (typeof schema !== "object" || schema === null) return null;
  return sources.get(schema) ?? null;
}
