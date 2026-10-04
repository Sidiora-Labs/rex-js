import * as zm from "zod/mini";
import {
  isStandardSchema,
  isZodSchema,
  type AsZodSchema,
  type StandardIssue,
  type StandardResult,
  type StandardSchemaV1,
} from "../core/standard.ts";

const sources = new WeakMap<object, StandardSchemaV1>();

function issueKeys(issue: StandardIssue): PropertyKey[] {
  return (issue.path ?? []).map((segment) =>
    typeof segment === "object" && segment !== null ? segment.key : segment,
  );
}

export function fromStandard<S extends StandardSchemaV1>(schema: S): AsZodSchema<S> {
  if (isZodSchema(schema)) return schema as AsZodSchema<S>;
  if (!isStandardSchema(schema)) {
    throw new TypeError(
      "fromStandard: the value does not implement the Standard Schema v1 interface",
    );
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
