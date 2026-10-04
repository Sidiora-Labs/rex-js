import { describe, expect, expectTypeOf, it } from "vitest";
import { action, type AnyAction } from "./action.ts";
import { RexDeclarationError, entity, type AnyEntity } from "./entity.ts";
import { always, policy, type AnyPolicy } from "./policy.ts";
import { createRegistry } from "./registry.ts";
import { id, text } from "./schema.ts";
import { z } from "zod/mini";

const makeAction = (name: string) =>
  action(name, {
    input: z.object({}),
    output: z.object({}),
    policy: always(),
    effect: "read",
    handler: () => ({}),
  });

const account = entity("account", { fields: { id: id(), name: text() }, label: (r) => r.name });
const token = entity("token", { fields: { id: id() }, label: (r) => r.id });
const wallet = policy("wallet", { permissions: ["view"], resolve: () => ["view"] });
const viewer = policy("viewer", { permissions: ["view"], resolve: () => [] });

describe("createRegistry", () => {
  it("collects declarations by kind and orders them by id", () => {
    const snapshot = createRegistry()
      .register(token, makeAction("toggle-hide-dust"), viewer)
      .register(makeAction("send"), account, wallet, makeAction("pick-token"))
      .freeze();
    expect(snapshot.entities.map((d) => d.id)).toEqual(["account", "token"]);
    expect(snapshot.actions.map((d) => d.id)).toEqual(["pick-token", "send", "toggle-hide-dust"]);
    expect(snapshot.policies.map((d) => d.id)).toEqual(["viewer", "wallet"]);
  });

  it("orders independently of registration order", () => {
    const names = ["b", "a.c", "a-b", "a", "c1", "a.b"];
    const forward = createRegistry();
    const backward = createRegistry();
    for (const name of names) forward.register(makeAction(name));
    for (const name of [...names].reverse()) backward.register(makeAction(name));
    const expected = ["a", "a-b", "a.b", "a.c", "b", "c1"];
    expect(forward.freeze().actions.map((d) => d.id)).toEqual(expected);
    expect(backward.freeze().actions.map((d) => d.id)).toEqual(expected);
  });

  it("throws on a duplicate id within a kind", () => {
    const registry = createRegistry().register(makeAction("send"));
    try {
      registry.register(makeAction("send"));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RexDeclarationError);
      expect((error as RexDeclarationError).declaration).toBe("action");
      expect((error as RexDeclarationError).id).toBe("send");
      expect((error as Error).message).toContain("already registered");
    }
    const other = entity("account", { fields: { id: id() }, label: (r) => r.id });
    expect(() => createRegistry().register(account, other)).toThrow(RexDeclarationError);
  });

  it("allows the same id in different kinds and the same declaration twice", () => {
    const sendEntity = entity("send", { fields: { id: id() }, label: (r) => r.id });
    const send = makeAction("send");
    const snapshot = createRegistry().register(send, sendEntity, send).freeze();
    expect(snapshot.actions).toEqual([send]);
    expect(snapshot.entities).toEqual([sendEntity]);
  });

  it("rejects values that are not declarations", () => {
    const incomplete = expect.objectContaining({ name: "RexError", code: "REX224" });
    expect(() => createRegistry().register({ kind: "widget", id: "x" } as never)).toThrow(
      incomplete,
    );
    expect(() => createRegistry().register({ kind: "action" } as never)).toThrow("no id");
    expect(() => createRegistry().register(null as never)).toThrow(incomplete);
  });

  it("returns an immutable snapshot with lookups", () => {
    const registry = createRegistry().register(account, wallet);
    const snapshot = registry.freeze();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.entities)).toBe(true);
    expect(snapshot.find("entity", "account")).toBe(account);
    expect(snapshot.find("policy", "nope")).toBeUndefined();
    expect(snapshot.get("policy", "wallet")).toBe(wallet);
    expect(() => snapshot.get("action", "send")).toThrow('unknown action "send"');
    expect(registry.has("entity", "account")).toBe(true);
    expect(registry.has("action", "account")).toBe(false);
    registry.register(token);
    expect(snapshot.entities.map((d) => d.id)).toEqual(["account"]);
    expect(registry.freeze().entities.map((d) => d.id)).toEqual(["account", "token"]);
    expect(Reflect.get(snapshot, "pages")).toEqual([]);
    expect(Reflect.get(snapshot, "flows")).toEqual([]);
  });

  it("types the snapshot lists", () => {
    const snapshot = createRegistry().freeze();
    expectTypeOf(snapshot.entities).toEqualTypeOf<readonly AnyEntity[]>();
    expectTypeOf(snapshot.actions).toEqualTypeOf<readonly AnyAction[]>();
    expectTypeOf(snapshot.policies).toEqualTypeOf<readonly AnyPolicy[]>();
  });
});
