import { describe, expect, expectTypeOf, it } from "vitest";
import { actor, anonymousActor, isAnonymous, type Actor } from "./actor.ts";
import { RexDeclarationError } from "./entity.ts";
import {
  allOf,
  always,
  anyOf,
  can,
  evaluate,
  never,
  policy,
  predicateToJson,
  requires,
  type PolicyResult,
} from "./policy.ts";

const wallet = policy("wallet", {
  permissions: ["view", "send", "manage"],
  resolve: (subject) => {
    if (subject.roles.includes("owner")) return ["view", "send", "manage"];
    if (subject.roles.includes("member")) return ["view", "send"];
    return subject.id === "anonymous" ? [] : ["view"];
  },
});

const owner = actor({
  id: "u-owner",
  roles: ["owner"],
  attributes: { unlocked: true, account: "acc-1", custody: "self" },
});
const member = actor({
  id: "u-member",
  roles: ["member"],
  permissions: ["export"],
  attributes: { unlocked: false, account: "acc-2", custody: "custodial" },
});
const viewer = actor({ id: "u-viewer" });

const ok: PolicyResult = { allowed: true, reason: null };
const no = (reason: string) => ({ allowed: false, reason });

describe("actor", () => {
  it("normalizes and freezes", () => {
    const subject = actor({ id: "u", roles: ["a", "a"], permissions: ["x"] });
    expect(subject.roles).toEqual(["a"]);
    expect(subject.attributes).toEqual({});
    expect(Object.isFrozen(subject)).toBe(true);
    expect(Object.isFrozen(subject.roles)).toBe(true);
  });

  it("rejects malformed actors", () => {
    expect(() => actor({ id: "" })).toThrow("id");
    expect(() => actor({ id: "u", roles: [""] })).toThrow("roles");
    expect(() => actor({ id: "u", attributes: [] as never })).toThrow("attributes");
  });

  it("provides the anonymous actor", () => {
    expect(anonymousActor).toEqual({ id: "anonymous", roles: [], permissions: [], attributes: {} });
    expect(isAnonymous(anonymousActor)).toBe(true);
    expect(isAnonymous(owner)).toBe(false);
    expect(Object.isFrozen(anonymousActor)).toBe(true);
  });
});

describe("policy declaration", () => {
  it("carries id, permissions and resolves granted permissions", () => {
    expect(wallet.kind).toBe("policy");
    expect(wallet.id).toBe("wallet");
    expect(wallet.permissions).toEqual(["view", "send", "manage"]);
    expect([...wallet.granted(member)]).toEqual(["view", "send"]);
    expect([...wallet.granted(anonymousActor)]).toEqual([]);
    expect(Object.isFrozen(wallet)).toBe(true);
  });

  it("types permission names", () => {
    expectTypeOf(wallet.permissions).toEqualTypeOf<readonly ("view" | "send" | "manage")[]>();
    expectTypeOf(wallet.can).parameter(0).toEqualTypeOf<"view" | "send" | "manage">();
  });

  it.each([
    ["Wallet", { permissions: ["view"], resolve: () => [] }, "id"],
    ["wallet", null, "config"],
    ["wallet", { permissions: [], resolve: () => [] }, "permissions"],
    ["wallet", { permissions: ["View"], resolve: () => [] }, "permissions.0"],
    ["wallet", { permissions: ["view", "view"], resolve: () => [] }, "permissions.1"],
    ["wallet", { permissions: ["view"], resolve: "all" }, "resolve"],
    ["wallet", { permissions: ["view"], resolve: () => [], extra: 1 }, "extra"],
  ])("rejects %s %j naming field %s", (name, config, field) => {
    try {
      policy(name, config as never);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RexDeclarationError);
      expect((error as RexDeclarationError).field).toBe(field);
    }
  });

  it("rejects predicates naming unknown permissions", () => {
    expect(() => wallet.can("delete" as never)).toThrow('names unknown permission "delete"');
    expect(() => wallet.requires({ permissions: ["delete" as never] })).toThrow("delete");
  });

  it("throws when resolve grants a permission outside the table", () => {
    const broken = policy("broken", {
      permissions: ["view"],
      resolve: () => ["view", "root"] as never,
    });
    expect(() => evaluate(broken.can("view"), owner)).toThrow('granted unknown permission "root"');
  });
});

describe("predicates", () => {
  it("always and never", () => {
    expect(evaluate(always(), anonymousActor)).toEqual(ok);
    expect(evaluate(never(), owner)).toEqual(no("never"));
  });

  it("can with a policy uses the policy grants", () => {
    expect(evaluate(wallet.can("send"), member)).toEqual(ok);
    expect(evaluate(wallet.can("manage"), member)).toEqual(no("missing-permission:manage"));
    expect(evaluate(wallet.can("view"), viewer)).toEqual(ok);
  });

  it("standalone can uses the actor permissions", () => {
    expect(evaluate(can("export"), member)).toEqual(ok);
    expect(evaluate(can("export"), owner)).toEqual(no("missing-permission:export"));
    expect(() => can("Export")).toThrow("permission");
  });

  it("requires unlocked", () => {
    expect(evaluate(requires({ unlocked: true }), owner)).toEqual(ok);
    expect(evaluate(requires({ unlocked: true }), member)).toEqual(no("locked"));
    expect(evaluate(requires({ unlocked: false }), member)).toEqual(ok);
  });

  it("requires account", () => {
    expect(evaluate(requires({ account: true }), member)).toEqual(ok);
    expect(evaluate(requires({ account: true }), viewer)).toEqual(no("no-account"));
    const blank = actor({ id: "u", attributes: { account: "" } });
    expect(evaluate(requires({ account: true }), blank)).toEqual(no("no-account"));
  });

  it("requires custody", () => {
    expect(evaluate(requires({ custody: "self" }), owner)).toEqual(ok);
    expect(evaluate(requires({ custody: "self" }), member)).toEqual(no("custody-mismatch"));
    expect(evaluate(requires({ custody: ["self", "custodial"] }), member)).toEqual(ok);
    expect(evaluate(requires({ custody: "self" }), viewer)).toEqual(no("custody-mismatch"));
  });

  it("requires permissions, standalone and policy bound", () => {
    expect(evaluate(requires({ permissions: ["export"] }), member)).toEqual(ok);
    expect(evaluate(wallet.requires({ permissions: ["view", "send"] }), member)).toEqual(ok);
    expect(evaluate(wallet.requires({ permissions: ["view", "manage"] }), member)).toEqual(
      no("missing-permission:manage"),
    );
  });

  it("requires reports the first failing clause in a stable order", () => {
    const strict = wallet.requires({
      unlocked: true,
      account: true,
      custody: "self",
      permissions: ["manage"],
    });
    expect(evaluate(strict, owner)).toEqual(ok);
    expect(evaluate(strict, anonymousActor)).toEqual(no("locked"));
    const unlockedNoAccount = actor({ id: "u", roles: ["owner"], attributes: { unlocked: true } });
    expect(evaluate(strict, unlockedNoAccount)).toEqual(no("no-account"));
    const wrongCustody = actor({
      id: "u",
      roles: ["owner"],
      attributes: { unlocked: true, account: "a", custody: "custodial" },
    });
    expect(evaluate(strict, wrongCustody)).toEqual(no("custody-mismatch"));
    const notOwner = actor({
      id: "u",
      roles: ["member"],
      attributes: { unlocked: true, account: "a", custody: "self" },
    });
    expect(evaluate(strict, notOwner)).toEqual(no("missing-permission:manage"));
  });

  it("rejects malformed requires clauses", () => {
    expect(() => requires({})).toThrow("at least one condition");
    expect(() => requires({ admin: true } as never)).toThrow("admin");
    expect(() => requires({ unlocked: "yes" } as never)).toThrow("unlocked");
    expect(() => requires({ account: 1 } as never)).toThrow("account");
    expect(() => requires({ custody: [] })).toThrow("custody");
    expect(() => requires({ permissions: "send" } as never)).toThrow("permissions");
  });

  it("allOf requires every clause and reports the first failure", () => {
    const predicate = allOf(requires({ unlocked: true }), wallet.can("send"));
    expect(evaluate(predicate, owner)).toEqual(ok);
    expect(evaluate(predicate, member)).toEqual(no("locked"));
    expect(evaluate(allOf(always(), wallet.can("manage")), member)).toEqual(
      no("missing-permission:manage"),
    );
  });

  it("anyOf allows on any clause and reports the first failure when all fail", () => {
    const predicate = anyOf(wallet.can("manage"), requires({ unlocked: true }));
    expect(evaluate(predicate, owner)).toEqual(ok);
    expect(evaluate(predicate, member)).toEqual(no("missing-permission:manage"));
    expect(evaluate(anyOf(never(), always()), anonymousActor)).toEqual(ok);
  });

  it("nests combinations", () => {
    const predicate = anyOf(allOf(requires({ unlocked: true }), wallet.can("send")), can("export"));
    expect(evaluate(predicate, owner)).toEqual(ok);
    expect(evaluate(predicate, member)).toEqual(ok);
    expect(evaluate(predicate, viewer)).toEqual(no("locked"));
  });

  it("rejects empty or invalid combinations", () => {
    expect(() => allOf()).toThrow("at least one predicate");
    expect(() => anyOf()).toThrow("at least one predicate");
    expect(() => allOf({} as never)).toThrow("predicates.0");
  });

  it("evaluates the anonymous actor without grants", () => {
    expect(evaluate(wallet.can("view"), anonymousActor)).toEqual(no("missing-permission:view"));
    expect(evaluate(requires({ account: true }), anonymousActor)).toEqual(no("no-account"));
    expect(evaluate(always(), anonymousActor)).toEqual(ok);
  });

  it("is pure: repeated evaluation returns equal results and leaves inputs untouched", () => {
    const predicate = wallet.requires({ unlocked: true, permissions: ["send"] });
    const snapshot = JSON.stringify(owner);
    const results = Array.from({ length: 3 }, () => evaluate(predicate, owner as Actor));
    expect(results).toEqual([ok, ok, ok]);
    expect(JSON.stringify(owner)).toBe(snapshot);
    expect(Object.isFrozen(predicate)).toBe(true);
  });

  it("serializes predicates with policy ids", () => {
    expect(
      predicateToJson(
        anyOf(wallet.requires({ unlocked: true, permissions: ["send"] }), can("export"), never()),
      ),
    ).toEqual({
      kind: "anyOf",
      predicates: [
        {
          kind: "requires",
          unlocked: true,
          account: false,
          custody: null,
          permissions: ["send"],
          policy: "wallet",
        },
        { kind: "can", permission: "export", policy: null },
        { kind: "never" },
      ],
    });
  });
});
