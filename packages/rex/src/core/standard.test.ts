import { describe, expect, expectTypeOf, it } from "vitest";
import * as zm from "zod/mini";
import { z } from "zod/mini";
import {
  StandardValidationError,
  formatIssues,
  fromStandard,
  isStandardSchema,
  isZodSchema,
  issuePath,
  standardSource,
  validateStandard,
  validateStandardSync,
  type StandardInferInput,
  type StandardInferOutput,
  type StandardResult,
  type StandardSchemaV1,
} from "./standard.ts";

function amountResult(value: unknown): StandardResult<{ amount: number }> {
  if (typeof value !== "object" || value === null) {
    return { issues: [{ message: "must be an object" }] };
  }
  const raw = (value as { amount?: unknown }).amount;
  if (typeof raw !== "string") {
    return { issues: [{ message: "must be a decimal string", path: ["amount"] }] };
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { issues: [{ message: "must be positive", path: [{ key: "amount" }] }] };
  }
  return { value: { amount } };
}

const handAmount: StandardSchemaV1<{ amount: string }, { amount: number }> = {
  "~standard": { version: 1, vendor: "hand", validate: amountResult },
};

const asyncAmount: StandardSchemaV1<{ amount: string }, { amount: number }> = {
  "~standard": {
    version: 1,
    vendor: "hand-async",
    validate: async (value) => amountResult(value),
  },
};

describe("Standard Schema detection", () => {
  it("recognises zod, zod/mini and hand-written schemas", () => {
    expect(isStandardSchema(z.string())).toBe(true);
    expect(isStandardSchema(zm.string())).toBe(true);
    expect(isStandardSchema(handAmount)).toBe(true);
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema({ "~standard": { version: 2, vendor: "x", validate: () => ({}) } })).toBe(
      false,
    );
    expect(isStandardSchema(null)).toBe(false);
    expect(isZodSchema(z.string())).toBe(true);
    expect(isZodSchema(zm.string())).toBe(true);
    expect(isZodSchema(handAmount)).toBe(false);
  });

  it("infers input and output types", () => {
    expectTypeOf<StandardInferInput<typeof handAmount>>().toEqualTypeOf<{ amount: string }>();
    expectTypeOf<StandardInferOutput<typeof handAmount>>().toEqualTypeOf<{ amount: number }>();
  });
});

describe("validateStandard", () => {
  it("returns the value or the issues of any vendor", async () => {
    expect(await validateStandard(handAmount, { amount: "2.5" })).toEqual({ value: { amount: 2.5 } });
    const failed = await validateStandard(handAmount, { amount: "-1" });
    expect(failed.issues?.map(issuePath)).toEqual(["amount"]);
    expect(await validateStandard(z.object({ n: z.number() }), { n: 1 })).toEqual({
      value: { n: 1 },
    });
    expect((await validateStandard(zm.number(), "x")).issues).toHaveLength(1);
    expect(await validateStandard(asyncAmount, { amount: "3" })).toEqual({ value: { amount: 3 } });
  });

  it("validates synchronously and refuses an asynchronous schema", () => {
    expect(validateStandardSync(handAmount, { amount: "1" })).toEqual({ value: { amount: 1 } });
    expect(() => validateStandardSync(asyncAmount, { amount: "1" })).toThrow(/asynchronously/);
  });

  it("formats issues with their paths", () => {
    expect(
      formatIssues([
        { message: "must be positive", path: [{ key: "amount" }] },
        { message: "is required", path: ["to", 0] },
        { message: "is invalid" },
      ]),
    ).toBe("amount must be positive; to.0 is required; input is invalid");
    const error = new StandardValidationError([{ message: "bad", path: ["a"] }]);
    expect(error.message).toBe("a bad");
    expect(error.issues).toHaveLength(1);
  });
});

describe("fromStandard", () => {
  it("keeps zod schemas as they are", () => {
    const schema = z.object({ a: z.string() });
    expect(fromStandard(schema)).toBe(schema);
    const mini = zm.object({ a: zm.string() });
    expect(fromStandard(mini)).toBe(mini);
    expect(standardSource(schema)).toBeNull();
  });

  it("adapts a hand-written schema into a zod schema that validates through ~standard", async () => {
    const adapter = fromStandard(handAmount);
    expect(isZodSchema(adapter)).toBe(true);
    expect(standardSource(adapter)).toBe(handAmount);
    expect(adapter.parse({ amount: "4" })).toEqual({ amount: 4 });
    const failed = adapter.safeParse({ amount: "0" });
    expect(failed.success).toBe(false);
    expect(failed.error?.issues.map((issue) => [issue.path.join("."), issue.message])).toEqual([
      ["amount", "must be positive"],
    ]);
    const standard = await adapter["~standard"].validate({ amount: "7" });
    expect(standard).toEqual({ value: { amount: 7 } });
    expectTypeOf<ReturnType<typeof adapter.parse>>().toEqualTypeOf<{ amount: number }>();
  });

  it("adapts an asynchronous schema for asynchronous parsing", async () => {
    const adapter = fromStandard(asyncAmount);
    expect(await adapter.parseAsync({ amount: "5" })).toEqual({ amount: 5 });
    expect((await adapter.safeParseAsync({ amount: "x" })).success).toBe(false);
    expect(() => adapter.parse({ amount: "5" })).toThrow();
  });

  it("refuses values that are not Standard Schemas", () => {
    expect(() => fromStandard({} as never)).toThrow(TypeError);
  });
});
