import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { always } from "../core/policy.ts";
import { memoryLedger } from "./audit.ts";
import type { RexContext } from "./context.ts";
import {
  buildActionRouter,
  CONFIRM_PROCEDURE,
  MAX_PENDING_CONFIRMATIONS,
  MAX_PENDING_CONFIRMATIONS_PER_ACTOR,
} from "./router.ts";

function setup(confirmTtlMs = 60_000) {
  const executed: number[] = [];
  const transfer = action("transfer", {
    input: z.object({ amount: z.number() }),
    output: z.number(),
    policy: always(),
    effect: "irreversible",
    handler(input) {
      executed.push(input.amount);
      return input.amount;
    },
  });
  const router = buildActionRouter(
    { actions: [transfer] },
    { ledger: memoryLedger(), confirmTtlMs },
  );
  const context = (id: string, confirm?: string): RexContext => ({
    actor: actor({ id }),
    density: "default",
    confirm,
  });
  const issue = (id: string, amount = 1) =>
    call(
      router[CONFIRM_PROCEDURE],
      {
        action: "transfer",
        input: { amount },
      },
      { context: context(id) },
    );
  const consume = (id: string, token: string, amount = 1) =>
    call(router.transfer, { amount }, { context: context(id, token) });
  return { issue, consume, executed };
}

describe("confirmation capacity", () => {
  it("reserves per-actor capacity across concurrent digests and preserves admitted grants", async () => {
    const server = setup();
    const results = await Promise.allSettled(
      Array.from({ length: MAX_PENDING_CONFIRMATIONS_PER_ACTOR + 8 }, () => server.issue("alice")),
    );
    const grants = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    expect(grants).toHaveLength(MAX_PENDING_CONFIRMATIONS_PER_ACTOR);
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    }
    expect(server.executed).toEqual([]);
    await expect(server.issue("bob")).resolves.toMatchObject({ action: "transfer" });
    for (const grant of grants) await expect(server.consume("alice", grant.token)).resolves.toBe(1);
    await expect(server.consume("alice", grants[0]!.token)).rejects.toMatchObject({
      code: "PRECONDITION_REQUIRED",
    });
    await expect(server.issue("alice")).resolves.toMatchObject({ action: "transfer" });
    expect(server.executed).toHaveLength(MAX_PENDING_CONFIRMATIONS_PER_ACTOR);
  });

  it("reserves global capacity across distinct actors and reclaims consumed capacity", async () => {
    const server = setup();
    const results = await Promise.allSettled(
      Array.from({ length: MAX_PENDING_CONFIRMATIONS + 8 }, (_, index) =>
        server.issue(`actor-${index}`),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      MAX_PENDING_CONFIRMATIONS,
    );
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    }
    const index = results.findIndex((result) => result.status === "fulfilled");
    const result = results[index]!;
    if (result.status !== "fulfilled") throw new Error("No admitted grant");
    await expect(server.issue("new-actor")).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await server.consume(`actor-${index}`, result.value.token);
    await expect(server.issue("new-actor")).resolves.toMatchObject({ action: "transfer" });
  });

  it("reclaims expired grants without executing them", async () => {
    const server = setup(30);
    const grants = await Promise.all(
      Array.from({ length: MAX_PENDING_CONFIRMATIONS_PER_ACTOR }, () => server.issue("alice")),
    );
    const expiry = Math.max(...grants.map((grant) => Date.parse(grant.expiresAt)));
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, expiry - Date.now()) + 1));
    await expect(server.issue("alice")).resolves.toMatchObject({ action: "transfer" });
    await expect(server.consume("alice", grants[0]!.token)).rejects.toMatchObject({
      code: "PRECONDITION_REQUIRED",
    });
    expect(server.executed).toEqual([]);
  });
});
