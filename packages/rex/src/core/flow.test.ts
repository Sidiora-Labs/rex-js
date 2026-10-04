import { beforeEach, describe, expect, it } from "vitest";
import { buildManifest } from "../manifest/build.ts";
import { action } from "./action.ts";
import { actor } from "./actor.ts";
import { RexDeclarationError } from "./entity.ts";
import { FlowDecisionError, decide, flow, runFlow } from "./flow.ts";
import { memoryJournal, statusOf, type Journal } from "./journal.ts";
import { always, policy } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { integer, text } from "./schema.ts";
import { z } from "zod/mini";

const treasury = policy("treasury", {
  permissions: ["approve", "pay"],
  resolve: (subject) => (subject.roles.includes("treasurer") ? ["approve", "pay"] : []),
});

const calls: string[] = [];

const quote = action("quote", {
  input: z.object({ amount: integer({ min: 1 }) }),
  output: z.object({ fee: integer() }),
  policy: always(),
  effect: "read",
  handler: (input) => {
    calls.push(`quote:${input.amount}`);
    return { fee: Math.ceil(input.amount / 100) };
  },
});

const pay = action("pay", {
  input: z.object({ total: integer({ min: 1 }), memo: text() }),
  output: z.object({ txId: text() }),
  policy: treasury.can("pay"),
  effect: "irreversible",
  handler: (input) => {
    calls.push(`pay:${input.total}`);
    if (input.memo === "explode") throw new Error("ledger offline");
    return { txId: `tx-${input.total}` };
  },
});

const treasurer = actor({ id: "u-treasurer", roles: ["treasurer"] });
const clerk = actor({ id: "u-clerk" });

function makePayout(journal: Journal) {
  return flow("payout", {
    journal,
    steps: [
      { action: quote, input: (ctx) => ({ amount: (ctx.input as { amount: number }).amount }) },
      { approval: "review", label: "Review payout", approvers: treasury.can("approve") },
      {
        action: pay,
        input: (ctx) => {
          const { amount, memo } = ctx.input as { amount: number; memo: string };
          return { total: amount + (ctx.outputs[0] as { fee: number }).fee, memo };
        },
      },
    ],
  });
}

function makeDirect(journal: Journal) {
  return flow("direct", {
    journal,
    steps: [
      { action: quote, input: () => ({ amount: 500 }) },
      {
        action: pay,
        input: (ctx) => ({ total: (ctx.outputs[0] as { fee: number }).fee, memo: "fee" }),
      },
    ],
  });
}

beforeEach(() => {
  calls.length = 0;
});

describe("flow declaration", () => {
  it("is frozen and normalizes steps", () => {
    const payout = makePayout(memoryJournal());
    expect(payout.kind).toBe("flow");
    expect(payout.id).toBe("payout");
    expect(payout.steps.map((step) => step.kind)).toEqual(["action", "approval", "action"]);
    expect(payout.steps[1]).toMatchObject({
      kind: "approval",
      id: "review",
      label: "Review payout",
    });
    expect(Object.isFrozen(payout)).toBe(true);
    expect(Object.isFrozen(payout.steps)).toBe(true);
    expect(Object.isFrozen(payout.steps[0])).toBe(true);
  });

  it.each([
    [
      "id",
      () =>
        flow("Payout", { journal: memoryJournal(), steps: [{ action: quote, input: () => ({}) }] }),
    ],
    ["config", () => flow("payout", null as never)],
    ["extra", () => flow("payout", { journal: memoryJournal(), steps: [], extra: 1 } as never)],
    ["steps", () => flow("payout", { journal: memoryJournal(), steps: [] })],
    [
      "journal",
      () => flow("payout", { journal: {} as never, steps: [{ action: quote, input: () => ({}) }] }),
    ],
    [
      "steps.0",
      () => flow("payout", { journal: memoryJournal(), steps: [{ label: "x" } as never] }),
    ],
    [
      "steps.0.action",
      () =>
        flow("payout", {
          journal: memoryJournal(),
          steps: [{ action: {}, input: () => ({}) } as never],
        }),
    ],
    [
      "steps.0.input",
      () => flow("payout", { journal: memoryJournal(), steps: [{ action: quote } as never] }),
    ],
    [
      "steps.0.approval",
      () =>
        flow("payout", {
          journal: memoryJournal(),
          steps: [{ approval: "Review", label: "x", approvers: always() }],
        }),
    ],
    [
      "steps.0.label",
      () =>
        flow("payout", {
          journal: memoryJournal(),
          steps: [{ approval: "review", label: "", approvers: always() }],
        }),
    ],
    [
      "steps.0.approvers",
      () =>
        flow("payout", {
          journal: memoryJournal(),
          steps: [{ approval: "review", label: "x", approvers: "admins" } as never],
        }),
    ],
    [
      "steps.1.approval",
      () =>
        flow("payout", {
          journal: memoryJournal(),
          steps: [
            { approval: "review", label: "x", approvers: always() },
            { approval: "review", label: "y", approvers: always() },
          ],
        }),
    ],
  ])("rejects a malformed declaration naming field %s", (field, run) => {
    try {
      run();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RexDeclarationError);
      expect((error as RexDeclarationError).field).toBe(field);
    }
  });

  it("registers as a flow and appears in the manifest", () => {
    const payout = makePayout(memoryJournal());
    const snapshot = createRegistry().register(payout, quote, pay, treasury).freeze();
    expect(snapshot.flows).toEqual([payout]);
    expect(buildManifest(snapshot).flows).toEqual([
      {
        id: "payout",
        steps: [
          { kind: "action", action: "quote" },
          {
            kind: "approval",
            id: "review",
            label: "Review payout",
            approvers: { kind: "can", permission: "approve", policy: "treasury" },
          },
          { kind: "action", action: "pay" },
        ],
      },
    ]);
  });
});

describe("runFlow", () => {
  it("runs every step to completion and journals each one", async () => {
    const journal = memoryJournal();
    const direct = makeDirect(journal);
    const result = await runFlow(direct, "i-1", { actor: treasurer });
    expect(result.status).toBe("completed");
    expect(result.gate).toBeNull();
    expect(calls).toEqual(["quote:500", "pay:5"]);
    expect(result.instance.entries.map((entry) => entry.type)).toEqual([
      "step",
      "step",
      "completed",
    ]);
    expect(result.instance.entries[1]).toMatchObject({
      type: "step",
      index: 1,
      action: "pay",
      output: { txId: "tx-5" },
    });
    expect((await journal.load("i-1"))?.status).toBe("completed");
  });

  it("does nothing more for a completed instance", async () => {
    const direct = makeDirect(memoryJournal());
    await runFlow(direct, "i-1", { actor: treasurer });
    calls.length = 0;
    const again = await runFlow(direct, "i-1", { actor: treasurer });
    expect(again.status).toBe("completed");
    expect(calls).toEqual([]);
    expect(again.instance.entries).toHaveLength(3);
  });

  it("restarts from the first incomplete step of a partial journal", async () => {
    const journal = memoryJournal();
    await journal.open("direct", "i-2", undefined);
    await journal.record("i-2", {
      type: "step",
      index: 0,
      action: "quote",
      output: { fee: 7 },
      at: "2026-10-04T00:00:00.000Z",
    });
    const direct = makeDirect(journal);
    const result = await runFlow(direct, "i-2", { actor: treasurer });
    expect(result.status).toBe("completed");
    expect(calls).toEqual(["pay:7"]);
    expect(result.instance.entries.map((entry) => entry.type)).toEqual([
      "step",
      "step",
      "completed",
    ]);
  });

  it("records a failed step and retries it on the next run", async () => {
    const journal = memoryJournal();
    const failing = flow("failing", {
      journal,
      steps: [
        { action: quote, input: () => ({ amount: 100 }) },
        { action: pay, input: (ctx) => ({ total: 1, memo: (ctx.input as { memo: string }).memo }) },
      ],
    });
    const failed = await runFlow(failing, "i-3", { actor: treasurer, input: { memo: "explode" } });
    expect(failed.status).toBe("failed");
    expect(failed.instance.entries.at(-1)).toMatchObject({
      type: "failed",
      index: 1,
      error: "ledger offline",
    });
    calls.length = 0;
    const retried = await runFlow(failing, "i-3", { actor: treasurer });
    expect(retried.status).toBe("failed");
    expect(calls).toEqual(["pay:1"]);
  });

  it("fails a step whose action policy denies the actor without running the handler", async () => {
    const direct = makeDirect(memoryJournal());
    const result = await runFlow(direct, "i-4", { actor: clerk });
    expect(result.status).toBe("failed");
    expect(calls).toEqual(["quote:500"]);
    expect(result.instance.entries.at(-1)).toMatchObject({
      type: "failed",
      index: 1,
      error: 'action "pay" is forbidden: missing-permission:pay',
    });
  });

  it("fails a step whose input does not match the action schema", async () => {
    const bad = flow("bad", {
      journal: memoryJournal(),
      steps: [{ action: quote, input: () => ({ amount: 0 }) }],
    });
    const result = await runFlow(bad, "i-5", { actor: clerk });
    expect(result.status).toBe("failed");
    expect(calls).toEqual([]);
  });
});

describe("approval gates", () => {
  let journal: Journal;
  beforeEach(() => {
    journal = memoryJournal();
  });

  it("pauses at the gate, then resumes on approve", async () => {
    const payout = makePayout(journal);
    const paused = await runFlow(payout, "p-1", {
      actor: clerk,
      input: { amount: 300, memo: "salary" },
    });
    expect(paused.status).toBe("paused");
    expect(paused.gate).toMatchObject({ id: "review", label: "Review payout" });
    expect(calls).toEqual(["quote:300"]);
    expect(await journal.list({ status: "paused" })).toHaveLength(1);

    const stillPaused = await runFlow(payout, "p-1", { actor: clerk });
    expect(stillPaused.status).toBe("paused");
    expect(stillPaused.instance.entries.filter((entry) => entry.type === "paused")).toHaveLength(1);

    const resumed = await decide(payout, "p-1", "approve", treasurer);
    expect(resumed.status).toBe("completed");
    expect(calls).toEqual(["quote:300", "pay:303"]);
    expect(resumed.instance.entries.map((entry) => entry.type)).toEqual([
      "step",
      "paused",
      "decision",
      "step",
      "completed",
    ]);
    expect(resumed.instance.entries[2]).toMatchObject({
      decision: "approve",
      actor: "u-treasurer",
      gate: "review",
    });
  });

  it("terminates on reject", async () => {
    const payout = makePayout(journal);
    await runFlow(payout, "p-2", { actor: clerk, input: { amount: 100, memo: "x" } });
    const rejected = await decide(payout, "p-2", "reject", treasurer);
    expect(rejected.status).toBe("rejected");
    expect(statusOf(rejected.instance.entries)).toBe("rejected");
    const after = await runFlow(payout, "p-2", { actor: treasurer });
    expect(after.status).toBe("rejected");
    expect(calls).toEqual(["quote:100"]);
  });

  it("refuses a duplicate decision", async () => {
    const payout = makePayout(journal);
    await runFlow(payout, "p-3", { actor: clerk, input: { amount: 100, memo: "x" } });
    await decide(payout, "p-3", "reject", treasurer);
    await expect(decide(payout, "p-3", "approve", treasurer)).rejects.toMatchObject({
      name: "FlowDecisionError",
      code: "NO_PENDING_APPROVAL",
    });
    await expect(decide(payout, "p-3", "reject", treasurer)).rejects.toBeInstanceOf(
      FlowDecisionError,
    );
    const instance = await journal.load("p-3");
    expect(instance?.entries.filter((entry) => entry.type === "decision")).toHaveLength(1);
  });

  it("refuses a decision by an actor outside the approvers policy", async () => {
    const payout = makePayout(journal);
    await runFlow(payout, "p-4", { actor: clerk, input: { amount: 100, memo: "x" } });
    await expect(decide(payout, "p-4", "approve", clerk)).rejects.toMatchObject({
      code: "FORBIDDEN",
      reason: "missing-permission:approve",
    });
    expect((await journal.load("p-4"))?.status).toBe("paused");
  });

  it("refuses decisions for unknown or running instances", async () => {
    const payout = makePayout(journal);
    await expect(decide(payout, "missing", "approve", treasurer)).rejects.toMatchObject({
      code: "NO_PENDING_APPROVAL",
    });
    const direct = makeDirect(journal);
    await runFlow(direct, "d-1", { actor: treasurer });
    await expect(decide(direct, "d-1", "approve", treasurer)).rejects.toMatchObject({
      code: "NO_PENDING_APPROVAL",
    });
    await expect(decide(payout, "d-1", "approve", treasurer)).rejects.toBeInstanceOf(
      FlowDecisionError,
    );
    await expect(decide(payout, "p-x", "maybe" as never, treasurer)).rejects.toThrow(TypeError);
  });
});

describe("memoryJournal", () => {
  it("opens idempotently, isolates records and lists by filter", async () => {
    const journal = memoryJournal();
    const first = await journal.open("payout", "b", { amount: 1 });
    const again = await journal.open("payout", "b", { amount: 2 });
    expect(again.input).toEqual({ amount: 1 });
    expect(first.status).toBe("running");
    await journal.open("direct", "a", null);
    await expect(journal.open("direct", "b", null)).rejects.toThrow('belongs to flow "payout"');
    await journal.record("a", { type: "completed", at: "2026-10-04T00:00:00.000Z" });
    expect((await journal.list()).map((instance) => instance.instanceId)).toEqual(["a", "b"]);
    expect(
      (await journal.list({ flowId: "payout" })).map((instance) => instance.instanceId),
    ).toEqual(["b"]);
    expect(
      (await journal.list({ status: "completed" })).map((instance) => instance.instanceId),
    ).toEqual(["a"]);
    const loaded = await journal.load("a");
    (loaded?.entries as unknown[]).push({ type: "failed" });
    expect((await journal.load("a"))?.entries).toHaveLength(1);
    expect(await journal.load("zzz")).toBeUndefined();
    await expect(journal.record("zzz", { type: "completed", at: "x" })).rejects.toThrow(
      "unknown instance",
    );
  });
});
