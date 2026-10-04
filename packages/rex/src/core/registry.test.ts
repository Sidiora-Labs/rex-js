import { describe, expect, expectTypeOf, it } from "vitest";
import { action, type AnyAction } from "./action.ts";
import { RexDeclarationError, entity, type AnyEntity } from "./entity.ts";
import { RexError } from "./errors.ts";
import { NOT_FOUND_PAGE_ID, page } from "./page.ts";
import { always, policy, type AnyPolicy } from "./policy.ts";
import { createRegistry, validatePageSet } from "./registry.ts";
import { id, text } from "../schema/index.ts";
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

describe("the page set check on freeze", () => {
  it("validates the not-found page and frame names once when the registry freezes", () => {
    const notFound = page(NOT_FOUND_PAGE_ID, { route: "/404", chrome: { nav: false } });
    const guarded = page(NOT_FOUND_PAGE_ID, {
      route: "/404",
      chrome: { nav: false },
      policy: wallet.can("view"),
    });
    const recovering = page("recovering", { route: "/recovering", recovery: "not-found" });
    const backing = page("backing", { route: "/backing", chrome: { back: "not-found" } });
    const docs = page("docs-home", { route: "/docs", chrome: { frame: "docs" } });
    const guide = page("guide", { route: "/guide", chrome: { frame: "docs" } });
    const shouting = page("shouting", { route: "/shouting", chrome: { frame: "dOCS" } });
    expect(createRegistry().register(notFound, docs, guide).freeze().pages).toHaveLength(3);
    const codeOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        expect(error).toBeInstanceOf(RexError);
        return (error as RexError).code;
      }
      throw new Error("expected a RexError");
    };
    expect(codeOf(() => createRegistry().register(guarded, wallet).freeze())).toBe("REX230");
    expect(codeOf(() => createRegistry().register(notFound, recovering).freeze())).toBe("REX230");
    expect(codeOf(() => createRegistry().register(notFound, backing).freeze())).toBe("REX230");
    expect(codeOf(() => createRegistry().register(docs, shouting).freeze())).toBe("REX225");
  });

  it("checks a page list directly with validatePageSet", () => {
    const notFound = page(NOT_FOUND_PAGE_ID, { route: "/404", chrome: { nav: false } });
    expect(() => validatePageSet([notFound])).not.toThrow();
    expect(() =>
      validatePageSet([notFound, page("lost", { route: "/lost", recovery: "not-found" })]),
    ).toThrow(RexError);
  });
});
