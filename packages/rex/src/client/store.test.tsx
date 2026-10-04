import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { createRegistry } from "../core/registry.ts";
import { buildManifest } from "../manifest/build.ts";
import { validateSidecar, type SidecarPayload } from "../manifest/sidecar.schema.ts";
import { readSidecar } from "./agent/sidecar.tsx";
import { createRexApp } from "./app.tsx";
import { REGION_ERROR_CODE } from "./boundary.tsx";
import { createOutcomeStore, OutcomeProvider } from "./outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";
import { resetAll } from "./reset.ts";
import { AgentShell } from "./shell.tsx";
import { store, storesToJSON, type RexStore, type StoreValue } from "./store.ts";

interface Cart {
  readonly items: readonly string[];
  readonly total: number;
}

const cart = store<Cart>("cart", { initial: { items: [], total: 0 }, expose: true });
const theme = store("theme", { initial: "light" as "light" | "dark", expose: true });
const draft = store("draft", { initial: "" });
const counter = store("counter", { initial: 0 });

const shop = page("shop", { route: "/", regions: ["basket"], states: ["ready"] });
const fragile = page("fragile", {
  route: "/fragile",
  regions: ["steady", "broken"],
  states: ["ready", "recoverable-error"],
});

const Basket = region("basket", () => {
  const value = cart.useStore();
  return <p>Basket {value.items.join(", ") || "empty"}</p>;
});
const Steady = region("steady", () => <p>steady content</p>);
const Broken = region("broken", (): never => {
  throw new Error("quotes unavailable");
});

function RecoverableError() {
  return <p role="alert">Region failed</p>;
}

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: shop,
    view: view(() => <Basket />),
    states: {},
    regions: { basket: Basket },
  }),
  definePageModules({
    page: fragile,
    view: view(() => (
      <>
        <Steady />
        <Broken />
      </>
    )),
    states: { RecoverableError },
    regions: { steady: Steady, broken: Broken },
  }),
];

const registry = createRegistry().register(shop, fragile).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer" });

function mount(path: string) {
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: viewer,
    baseUrl: "http://rex.test",
    queryClient: new QueryClient(),
  });
  const memory = memoryLocation({ path });
  render(
    <OutcomeProvider store={createOutcomeStore()}>
      <RexApp>
        <Router hook={memory.hook}>
          <AgentShell pages={pages} />
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
}

function sidecar(): SidecarPayload {
  const raw = readSidecar(document);
  const result = validateSidecar(raw);
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  expect(window.__rex).toEqual(result.payload);
  return result.payload;
}

afterEach(() => {
  cleanup();
  resetAll();
});

describe("store", () => {
  it("reads, sets and updates a typed value", () => {
    expectTypeOf(cart).toEqualTypeOf<RexStore<Cart>>();
    expectTypeOf(cart.get()).toEqualTypeOf<Cart>();
    expectTypeOf<StoreValue<typeof theme>>().toEqualTypeOf<"light" | "dark">();
    expectTypeOf(counter.update).parameter(0).toEqualTypeOf<(current: number) => number>();
    expect(cart.id).toBe("cart");
    expect(cart.expose).toBe(true);
    expect(counter.expose).toBe(false);
    expect(cart.get()).toEqual({ items: [], total: 0 });
    cart.set({ items: ["apple"], total: 3 });
    expect(cart.get()).toEqual({ items: ["apple"], total: 3 });
    cart.update((current) => ({ items: [...current.items, "pear"], total: current.total + 2 }));
    expect(cart.get()).toEqual({ items: ["apple", "pear"], total: 5 });
    theme.set("dark");
    expect(theme.get()).toBe("dark");
    counter.update((value) => value + 1);
    counter.update((value) => value + 1);
    expect(counter.get()).toBe(2);
  });

  it("notifies subscribers on change only and stops after unsubscribe", () => {
    const seen: number[] = [];
    const unsubscribe = counter.subscribe(() => seen.push(counter.get()));
    counter.set(1);
    counter.set(1);
    counter.update((value) => value + 4);
    unsubscribe();
    counter.set(9);
    expect(seen).toEqual([1, 5]);
    expect(counter.get()).toBe(9);
  });

  it("re-renders only the component that reads the changed store", async () => {
    const renders: Record<string, number> = {};
    const onRender: ProfilerOnRenderCallback = (id) => {
      renders[id] = (renders[id] ?? 0) + 1;
    };
    function CounterView() {
      return <p>Count {counter.useStore()}</p>;
    }
    function DraftView() {
      return <p>Draft [{draft.useStore()}]</p>;
    }
    render(
      <>
        <Profiler id="counter" onRender={onRender}>
          <CounterView />
        </Profiler>
        <Profiler id="draft" onRender={onRender}>
          <DraftView />
        </Profiler>
      </>,
    );
    expect(screen.getByText("Count 0")).toBeTruthy();
    expect(renders).toEqual({ counter: 1, draft: 1 });
    await act(async () => {
      counter.set(7);
    });
    expect(screen.getByText("Count 7")).toBeTruthy();
    expect(renders).toEqual({ counter: 2, draft: 1 });
    await act(async () => {
      draft.set("hello");
    });
    expect(screen.getByText("Draft [hello]")).toBeTruthy();
    expect(renders).toEqual({ counter: 2, draft: 2 });
    await act(async () => {
      counter.set(7);
    });
    expect(renders).toEqual({ counter: 2, draft: 2 });
  });

  it("refuses an invalid id, a duplicate id and a missing initial value", () => {
    expect(() => store("Bad Id", { initial: 1 })).toThrow('invalid store id "Bad Id"');
    expect(() => store("cart", { initial: { items: [], total: 0 } })).toThrow(
      'rex: store "cart" is already declared; store ids are unique',
    );
    expect(() => store("empty", {} as { initial: number })).toThrow(
      'rex: store "empty" needs an initial value',
    );
  });
});

describe("store reset", () => {
  it("leaves changed values behind at the end of a test", () => {
    counter.set(41);
    cart.set({ items: ["plum"], total: 1 });
    expect(counter.get()).toBe(41);
  });

  it("starts the next test from the initial values", () => {
    expect(counter.get()).toBe(0);
    expect(cart.get()).toEqual({ items: [], total: 0 });
  });

  it("resets every store through resetAll and notifies subscribers", () => {
    draft.set("typed");
    theme.set("dark");
    const seen: string[] = [];
    const unsubscribe = draft.subscribe(() => seen.push(draft.get()));
    resetAll();
    unsubscribe();
    expect(draft.get()).toBe("");
    expect(theme.get()).toBe("light");
    expect(seen).toEqual([""]);
  });
});

describe("store serialisation", () => {
  it("serialises a store and every declared store to JSON", () => {
    cart.set({ items: ["fig"], total: 4 });
    counter.set(3);
    expect(JSON.stringify(cart)).toBe('{"items":["fig"],"total":4}');
    expect(JSON.parse(JSON.stringify(counter))).toBe(3);
    expect(cart.toJSON()).toEqual({ items: ["fig"], total: 4 });
    expect(cart.toJSON()).not.toBe(cart.get());
    expect(storesToJSON()).toEqual({
      cart: { items: ["fig"], total: 4 },
      counter: 3,
      draft: "",
      theme: "light",
    });
    expect(Object.keys(storesToJSON())).toEqual(["cart", "counter", "draft", "theme"]);
  });

  it("refuses values that do not serialise to JSON", () => {
    expect(() => store("when", { initial: new Date(0) })).toThrow(
      'rex: store "when" holds a value that does not serialise to JSON at the value',
    );
    expect(() => store("lookup", { initial: { byId: new Map<string, number>() } })).toThrow(
      'rex: store "lookup" holds a value that does not serialise to JSON at byId',
    );
    expect(() => store("ratio", { initial: [1, Number.NaN] })).toThrow(
      'rex: store "ratio" holds a non-finite number at 1',
    );
    const holder = store<{ readonly run: unknown }>("holder", { initial: { run: null } });
    expect(() => holder.set({ run: () => 1 })).toThrow(
      'rex: store "holder" holds a value that does not serialise to JSON at run',
    );
    expect(holder.get()).toEqual({ run: null });
  });
});

describe("store in the sidecar", () => {
  it("lists exposed stores under stores and leaves private stores out", () => {
    draft.set("secret");
    mount("/");
    const payload = sidecar();
    expect(payload.page).toBe("shop");
    expect(payload.stores).toEqual({ cart: { items: [], total: 0 }, theme: "light" });
    expect(Object.keys(payload.stores ?? {})).toEqual(["cart", "theme"]);
    expect(payload.regions).toBeUndefined();
  });

  it("updates the sidecar and the reading region when an exposed store changes", async () => {
    mount("/");
    expect(screen.getByText("Basket empty")).toBeTruthy();
    await act(async () => {
      cart.update((current) => ({ items: [...current.items, "kiwi"], total: current.total + 1 }));
    });
    expect(screen.getByText("Basket kiwi")).toBeTruthy();
    expect(sidecar().stores).toEqual({ cart: { items: ["kiwi"], total: 1 }, theme: "light" });
    await act(async () => {
      theme.set("dark");
    });
    expect(sidecar().stores?.theme).toBe("dark");
    const before = sidecar();
    await act(async () => {
      draft.set("unseen");
    });
    expect(sidecar()).toEqual(before);
  });

  it("lists a failing region with its state and error code", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      mount("/fragile");
      await waitFor(() => expect(sidecar().regions).toBeDefined());
      const payload = sidecar();
      expect(payload.state).toBe("recoverable-error");
      expect(payload.regions).toEqual([
        {
          id: "broken",
          address: "fragile/broken",
          state: "recoverable-error",
          code: REGION_ERROR_CODE,
        },
      ]);
    } finally {
      console.error = original;
    }
  });
});
