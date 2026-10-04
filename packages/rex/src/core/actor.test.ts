import { describe, expect, it } from "vitest";
import { ANONYMOUS_ACTOR_ID, actor, anonymousActor, isAnonymous } from "./actor.ts";
import { isRexError } from "./errors.ts";

function failure(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (isRexError(error)) return error.message;
    throw error;
  }
  throw new Error("expected a RexError");
}

describe("actor", () => {
  it("deduplicates roles and permissions and freezes the result", () => {
    const attributes = { unlocked: true, account: "acct-1", tier: 2 };
    const subject = actor({
      id: "u1",
      roles: ["admin", "ops", "admin"],
      permissions: ["read", "read", "write"],
      attributes,
    });
    expect(subject).toEqual({
      id: "u1",
      roles: ["admin", "ops"],
      permissions: ["read", "write"],
      attributes: { unlocked: true, account: "acct-1", tier: 2 },
    });
    expect(Object.isFrozen(subject)).toBe(true);
    expect(Object.isFrozen(subject.roles)).toBe(true);
    expect(Object.isFrozen(subject.permissions)).toBe(true);
    expect(Object.isFrozen(subject.attributes)).toBe(true);
    expect(subject.attributes).not.toBe(attributes);
  });

  it("defaults roles, permissions and attributes to empty", () => {
    const subject = actor({ id: "u2" });
    expect(subject).toEqual({ id: "u2", roles: [], permissions: [], attributes: {} });
    expect(Object.isFrozen(subject.roles)).toBe(true);
    expect(Object.isFrozen(subject.attributes)).toBe(true);
  });

  it("rejects invalid input with REX329", () => {
    expect(failure(() => actor(null as never))).toBe("REX329 actor: expected an actor object");
    expect(failure(() => actor({ id: "" }))).toBe("REX329 actor: id must be a non-empty string");
    expect(failure(() => actor({ id: 1 as never }))).toBe(
      "REX329 actor: id must be a non-empty string",
    );
    expect(failure(() => actor({ id: "u", roles: ["admin", ""] }))).toBe(
      "REX329 actor: roles must be an array of non-empty strings",
    );
    expect(failure(() => actor({ id: "u", permissions: "read" as never }))).toBe(
      "REX329 actor: permissions must be an array of non-empty strings",
    );
    expect(failure(() => actor({ id: "u", attributes: ["x"] as never }))).toBe(
      "REX329 actor: attributes must be an object",
    );
  });

  it("identifies the anonymous actor by id", () => {
    expect(ANONYMOUS_ACTOR_ID).toBe("anonymous");
    expect(anonymousActor).toEqual({ id: "anonymous", roles: [], permissions: [], attributes: {} });
    expect(Object.isFrozen(anonymousActor)).toBe(true);
    expect(isAnonymous(anonymousActor)).toBe(true);
    expect(isAnonymous(actor({ id: ANONYMOUS_ACTOR_ID, roles: ["guest"] }))).toBe(true);
    expect(isAnonymous(actor({ id: "u1" }))).toBe(false);
  });
});
