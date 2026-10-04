import type * as zm from "zod/mini";
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

export class StandardValidationError extends Error {
  readonly issues: readonly StandardIssue[];

  constructor(issues: readonly StandardIssue[]) {
    super(formatIssues(issues));
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
  if (!isStandardSchema(value) || value["~standard"].vendor !== "zod") return false;
  const internals = (value as { _zod?: unknown })._zod;
  return (
    typeof internals === "object" &&
    internals !== null &&
    typeof (internals as { def?: unknown }).def === "object"
  );
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
