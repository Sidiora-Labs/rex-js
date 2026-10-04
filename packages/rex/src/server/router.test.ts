import { ORPCError, call } from "@orpc/server";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { action, type AnyAction } from "../core/action.ts";
import { actor, type Actor } from "../core/actor.ts";
import { always, never, policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean, integer, money, ref, text, z } from "../core/schema.ts";
import type { StandardSchemaV1 } from "../core/standard.ts";
import { digest, memoryLedger, type Ledger } from "./audit.ts";
import type { RexContext } from "./context.ts";
import { CONFIRM_PROCEDURE, auditCode, buildActionRouter, type ActionProcedure } from "./router.ts";

const SECRET_MEMO = "do-not-store-this-memo";

const wallet = policy("wallet", {
  permissions: ["send"],
  resolve: (subject) => subject.permissions.filter((permission) => permission === "send"),
});

const calls: string[] = [];

const send = action("send", {
  input: z.object({ to: ref("contact"), amount: money(), memo: text().optional() }),
  output: z.object({ txId: text(), status: z.enum(["pending", "confirmed"]) }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send",
  handler: (input) => {
    calls.push(`send:${input.to}:${input.amount}`);
    return { txId: `tx-${input.to}-${input.amount}`, status: "pending" as const };
  },
});

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input, ctx) => {
    calls.push(`toggle-dust:${ctx.actor.id}:${String(input.hide)}`);
    return { hide: input.hide };
  },
});

const explode = action("explode", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "reversible",
  handler: () => {
    calls.push("explode");
    throw new Error("boom");
  },
});

const conflict = action("conflict", {
  input: z.object({}),
  output: z.object({}),
  policy: always(),
  effect: "reversible",
  handler: () => {
    calls.push("conflict");
    throw new ORPCError("CONFLICT", { message: "already done" });
  },
});

const badOutput = action("bad-output", {
  input: z.object({}),
  output: z.object({ count: integer() }),
  policy: always(),
  effect: "read",
  handler: () => {
    calls.push("bad-output");
    return { count: "many" } as never;
  },
});

const purge = action("admin.purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  handler: () => {
    calls.push("admin.purge");
    return {};
  },
});

const alice = actor({ id: "alice", permissions: ["send"], attributes: { unlocked: true } });
const bob = actor({ id: "bob", permissions: ["send"], attributes: { unlocked: true } });
const locked = actor({ id: "carol", permissions: ["send"], attributes: { unlocked: false } });

function context(subject: Actor, confirm?: string): RexContext {
  return confirm === undefined
    ? { actor: subject, density: "default" }
    : { actor: subject, density: "default", confirm };
}

async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    return error as ORPCError<string, unknown>;
  }
  throw new Error("expected the call to reject");
}

const declared = [send, toggleDust, explode, conflict, badOutput, purge] as const;

function build(ledger: Ledger, confirmTtlMs?: number) {
  return buildActionRouter(
    { actions: declared },
    confirmTtlMs === undefined ? { ledger } : { ledger, confirmTtlMs },
  );
}

const transfer = { to: "bob", amount: "1.50" };

describe("buildActionRouter", () => {
  let ledger: Ledger;
  let router: ReturnType<typeof build>;

  beforeEach(() => {
    calls.length = 0;
    ledger = memoryLedger();
    router = build(ledger);
  });

  it("creates one procedure per action named by the action id plus the confirm procedure", () => {
    expect(Object.keys(router)).toEqual([
      "admin.purge",
      "bad-output",
      "conflict",
      "explode",
      "send",
      "toggle-dust",
      CONFIRM_PROCEDURE,
    ]);
  });

  it("types procedures from the declared schemas", () => {
    const typed = buildActionRouter({ actions: [send, toggleDust] }, { ledger });
    const toggle = () => call(typed["toggle-dust"], { hide: true }, { context: context(alice) });
    const transferNow = () => call(typed.send, transfer, { context: context(alice) });
    expectTypeOf(toggle).returns.resolves.toEqualTypeOf<{ hide: boolean }>();
    expectTypeOf(transferNow).returns.resolves.toEqualTypeOf<{
      txId: string;
      status: "pending" | "confirmed";
    }>();
    expectTypeOf(typed.send).toEqualTypeOf<ActionProcedure<typeof send>>();
  });

  it("builds from a frozen registry snapshot with procedures keyed by action id", async () => {
    const registry = createRegistry()
      .register(...declared)
      .freeze();
    const fromRegistry = buildActionRouter(registry, { ledger });
    expect(Object.keys(fromRegistry)).toEqual(Object.keys(router));
    const toggle = fromRegistry["toggle-dust"];
    expectTypeOf(toggle).toEqualTypeOf<ActionProcedure<AnyAction> | undefined>();
    if (toggle === undefined) throw new Error("toggle-dust procedure is missing");
    await expect(call(toggle, { hide: true }, { context: context(bob) })).resolves.toEqual({
      hide: true,
    });
    expect(calls).toEqual(["toggle-dust:bob:true"]);
  });

  it("runs an allowed action with validated input and output", async () => {
    await expect(
      call(router["toggle-dust"], { hide: true }, { context: context(alice) }),
    ).resolves.toEqual({ hide: true });
    expect(calls).toEqual(["toggle-dust:alice:true"]);
  });

  it("rejects a forbidden actor with the policy reason before the handler runs", async () => {
    const error = await rejection(
      call(router.send, transfer, { context: context(locked, "irrelevant") }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(error.status).toBe(403);
    expect(error.data).toEqual({ action: "send", reason: "locked" });
    const never = await rejection(call(router["admin.purge"], {}, { context: context(alice) }));
    expect(never.data).toEqual({ action: "admin.purge", reason: "never" });
    expect(calls).toEqual([]);
  });

  it("rejects invalid input with BAD_REQUEST before the handler runs", async () => {
    const error = await rejection(
      call(router["toggle-dust"], { hide: "yes" } as never, { context: context(alice) }),
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("rejects output that fails the declared schema", async () => {
    const error = await rejection(call(router["bad-output"], {}, { context: context(alice) }));
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("Output validation failed");
    expect(calls).toEqual(["bad-output"]);
  });

  describe("confirmation for irreversible actions", () => {
    it("refuses an irreversible action without a confirm token", async () => {
      const error = await rejection(call(router.send, transfer, { context: context(alice) }));
      expect(error.code).toBe("PRECONDITION_REQUIRED");
      expect(error.status).toBe(428);
      expect(error.data).toEqual({ action: "send", inputDigest: await digest(transfer) });
      expect(calls).toEqual([]);
    });

    it("runs once with a token bound to the action and input, then refuses reuse", async () => {
      const confirmation = await call(
        router[CONFIRM_PROCEDURE],
        { action: "send", input: transfer },
        { context: context(alice) },
      );
      expect(confirmation.action).toBe("send");
      expect(confirmation.inputDigest).toBe(await digest(transfer));
      expect(confirmation.token).toMatch(/^[0-9a-f]{64}$/);
      expect(Date.parse(confirmation.expiresAt)).toBeGreaterThan(Date.now());

      await expect(
        call(router.send, transfer, { context: context(alice, confirmation.token) }),
      ).resolves.toEqual({ txId: "tx-bob-1.50", status: "pending" });
      const reused = await rejection(
        call(router.send, transfer, { context: context(alice, confirmation.token) }),
      );
      expect(reused.code).toBe("PRECONDITION_REQUIRED");
      expect(reused.message).toContain("unknown or already used");
      expect(calls).toEqual(["send:bob:1.50"]);
    });

    it("refuses a token issued for different input or another actor", async () => {
      const forInput = await call(
        router[CONFIRM_PROCEDURE],
        { action: "send", input: transfer },
        { context: context(alice) },
      );
      const other = await rejection(
        call(
          router.send,
          { to: "bob", amount: "100" },
          { context: context(alice, forInput.token) },
        ),
      );
      expect(other.code).toBe("PRECONDITION_REQUIRED");
      expect(other.message).toContain("different action, input or actor");

      const forAlice = await call(
        router[CONFIRM_PROCEDURE],
        { action: "send", input: transfer },
        { context: context(alice) },
      );
      const stolen = await rejection(
        call(router.send, transfer, { context: context(bob, forAlice.token) }),
      );
      expect(stolen.code).toBe("PRECONDITION_REQUIRED");
      expect(calls).toEqual([]);
    });

    it("binds the token to the parsed input regardless of key order", async () => {
      const confirmation = await call(
        router[CONFIRM_PROCEDURE],
        { action: "send", input: { amount: "1.50", to: "bob" } },
        { context: context(alice) },
      );
      await expect(
        call(router.send, transfer, { context: context(alice, confirmation.token) }),
      ).resolves.toEqual({ txId: "tx-bob-1.50", status: "pending" });
    });

    it("refuses an expired token", async () => {
      const shortLived = build(ledger, 1);
      const confirmation = await call(
        shortLived[CONFIRM_PROCEDURE],
        { action: "send", input: transfer },
        { context: context(alice) },
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const error = await rejection(
        call(shortLived.send, transfer, { context: context(alice, confirmation.token) }),
      );
      expect(error.code).toBe("PRECONDITION_REQUIRED");
      expect(error.message).toContain("expired");
      expect(calls).toEqual([]);
    });

    it("issues no token for unknown, reversible, forbidden or invalid requests", async () => {
      const unknown = await rejection(
        call(router[CONFIRM_PROCEDURE], { action: "nope", input: {} }, { context: context(alice) }),
      );
      expect(unknown.code).toBe("NOT_FOUND");
      const reversible = await rejection(
        call(
          router[CONFIRM_PROCEDURE],
          { action: "toggle-dust", input: { hide: true } },
          { context: context(alice) },
        ),
      );
      expect(reversible.code).toBe("BAD_REQUEST");
      expect(reversible.message).toContain("needs no confirmation");
      const denied = await rejection(
        call(
          router[CONFIRM_PROCEDURE],
          { action: "send", input: transfer },
          { context: context(locked) },
        ),
      );
      expect(denied.code).toBe("FORBIDDEN");
      expect(denied.data).toEqual({ action: "send", reason: "locked" });
      const invalid = await rejection(
        call(
          router[CONFIRM_PROCEDURE],
          { action: "send", input: { to: "bob" } },
          { context: context(alice) },
        ),
      );
      expect(invalid.code).toBe("BAD_REQUEST");
      expect(invalid.message).toBe("Input validation failed");
    });
  });

  describe("audit", () => {
    it("appends one record per successful call", async () => {
      await call(router["toggle-dust"], { hide: false }, { context: context(alice) });
      const records = await ledger.list();
      expect(records).toHaveLength(1);
      const [record] = records;
      expect(record).toMatchObject({
        actor: "alice",
        actionId: "toggle-dust",
        inputDigest: await digest({ hide: false }),
        outcome: "ok",
        effect: "reversible",
      });
      expect(record?.durationMs).toBeGreaterThanOrEqual(0);
      expect(Date.parse(record?.at ?? "")).not.toBeNaN();
    });

    it("records failures with their error code and effect", async () => {
      await expect(call(router.explode, {}, { context: context(alice) })).rejects.toThrow("boom");
      await rejection(call(router.conflict, {}, { context: context(bob) }));
      await rejection(call(router.send, transfer, { context: context(locked) }));
      await rejection(call(router.send, transfer, { context: context(alice) }));
      await rejection(
        call(router["toggle-dust"], { hide: 1 } as never, { context: context(alice) }),
      );
      await rejection(call(router["bad-output"], {}, { context: context(alice) }));
      const records = await ledger.list();
      expect(
        records.map((record) => [record.actor, record.actionId, record.outcome, record.effect]),
      ).toEqual([
        ["alice", "explode", "INTERNAL_SERVER_ERROR", "reversible"],
        ["bob", "conflict", "CONFLICT", "reversible"],
        ["carol", "send", "FORBIDDEN", "irreversible"],
        ["alice", "send", "PRECONDITION_REQUIRED", "irreversible"],
        ["alice", "toggle-dust", "BAD_REQUEST", "reversible"],
        ["alice", "bad-output", "INTERNAL_SERVER_ERROR", "read"],
      ]);
      expect(calls).toEqual(["explode", "conflict", "bad-output"]);
    });

    it("records the confirmed irreversible call without storing raw input", async () => {
      const input = { ...transfer, memo: SECRET_MEMO };
      const confirmation = await call(
        router[CONFIRM_PROCEDURE],
        { action: "send", input },
        { context: context(alice) },
      );
      await call(router.send, input, { context: context(alice, confirmation.token) });
      const records = await ledger.list({ actionId: "send" });
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        outcome: "ok",
        effect: "irreversible",
        inputDigest: await digest(input),
      });
      expect(JSON.stringify(await ledger.list())).not.toContain(SECRET_MEMO);
    });
  });

  it("normalizes error codes into audit outcomes", () => {
    expect(auditCode(new Error("x"))).toBe("INTERNAL_SERVER_ERROR");
    expect(auditCode(new ORPCError("FORBIDDEN"))).toBe("FORBIDDEN");
    expect(auditCode(new ORPCError("insufficient-funds"))).toBe("INSUFFICIENT_FUNDS");
    expect(auditCode(new ORPCError("42-oops"))).toBe("E_42_OOPS");
  });

  it("rejects an invalid ledger, ttl or duplicate action", () => {
    expect(() => buildActionRouter({ actions: [send] }, { ledger: {} as never })).toThrow(
      "ledger must implement append and list",
    );
    expect(() => buildActionRouter({ actions: [send] }, { ledger, confirmTtlMs: 0 })).toThrow(
      RangeError,
    );
    expect(() => buildActionRouter({ actions: [send, send] }, { ledger })).toThrow(
      'duplicate action "send"',
    );
  });
});

describe("Standard Schema actions through the router", () => {
  const amount: StandardSchemaV1<{ amount: string }, { amount: number }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) => {
        const raw = (value as { amount?: unknown } | null)?.amount;
        const parsed = typeof raw === "string" ? Number(raw) : Number.NaN;
        return Number.isFinite(parsed) && parsed > 0
          ? { value: { amount: parsed } }
          : { issues: [{ message: "must be a positive decimal", path: ["amount"] }] };
      },
    },
  };
  const paid: StandardSchemaV1<{ paid: number }> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof (value as { paid?: unknown } | null)?.paid === "number"
          ? { value: value as { paid: number } }
          : { issues: [{ message: "must report the paid amount", path: ["paid"] }] },
    },
  };
  const seen: number[] = [];
  const tip = action("tip", {
    input: amount,
    output: paid,
    policy: always(),
    effect: "reversible",
    handler: (input) => {
      seen.push(input.amount);
      return { paid: input.amount };
    },
  });
  const payout = action("payout", {
    input: amount,
    output: paid,
    policy: always(),
    effect: "irreversible",
    handler: (input) => {
      seen.push(input.amount);
      return { paid: input.amount };
    },
  });

  beforeEach(() => {
    seen.length = 0;
  });

  it("validates input and output through ~standard.validate and hands the handler the parsed value", async () => {
    const router = buildActionRouter({ actions: [tip, payout] }, { ledger: memoryLedger() });
    await expect(call(router.tip, { amount: "2.5" }, { context: context(alice) })).resolves.toEqual({
      paid: 2.5,
    });
    expect(seen).toEqual([2.5]);
    const invalid = await rejection(
      call(router.tip, { amount: "zero" }, { context: context(alice) }),
    );
    expect(invalid.code).toBe("BAD_REQUEST");
    expect(seen).toEqual([2.5]);
  });

  it("issues a confirm token only for input the Standard Schema accepts", async () => {
    const router = buildActionRouter({ actions: [tip, payout] }, { ledger: memoryLedger() });
    const refused = await rejection(
      call(
        router[CONFIRM_PROCEDURE],
        { action: "payout", input: { amount: "-1" } },
        { context: context(alice) },
      ),
    );
    expect(refused.code).toBe("BAD_REQUEST");
    expect(refused.data).toEqual({
      action: "payout",
      issues: [{ code: "custom", message: "must be a positive decimal", path: ["amount"] }],
    });
    const grant = await call(
      router[CONFIRM_PROCEDURE],
      { action: "payout", input: { amount: "3" } },
      { context: context(alice) },
    );
    expect(grant.inputDigest).toBe(await digest({ amount: 3 }));
    await expect(
      call(router.payout, { amount: "3" }, { context: context(alice, grant.token) }),
    ).resolves.toEqual({ paid: 3 });
    expect(seen).toEqual([3]);
  });
});
