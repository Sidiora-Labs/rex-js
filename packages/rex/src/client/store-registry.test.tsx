import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { RexError } from "../core/errors.ts";
import { resetAll } from "./reset.ts";
import {
  StoreRegistryProvider,
  createStoreRegistry,
  defaultStoreRegistry,
  toJsonValue,
  useExposedStores,
  useStoreRegistry,
} from "./store-registry.ts";
import {
  createStoreRegistry as createFromStore,
  defaultStoreRegistry as defaultFromStore,
  store,
  useExposedStores as useFromStore,
  type RexStore,
} from "./store.ts";

interface Cart {
  readonly items: readonly string[];
}

const cart = store<Cart>("cart", { initial: { items: [] }, expose: true });
const theme = store("theme", { initial: "light" as "light" | "dark", expose: true });
const draft = store("draft", { initial: "" });

function entry(declared: RexStore<Cart> | RexStore<string> | RexStore<"light" | "dark">) {
  return declared as RexStore<unknown>;
}

afterEach(() => {
  cleanup();
  resetAll();
});

describe("createStoreRegistry", () => {
  it("isolates immutable declaration snapshots from mutable stores and other server registries", () => {
    const initial = { items: ["public"] };
    const declared = store("server-snapshot", { initial });
    initial.items.push("private");
    declared.set({ items: ["tenant-secret"] });
    const first = createStoreRegistry({ follow: false, server: true });
    const second = createStoreRegistry({ follow: false, server: true });
    first.register(declared);
    second.register(declared);
    first.register(entry(cart));
    second.register(entry(cart));
    cart.set({ items: ["tenant-secret"] });
    const snapshot = first.toJSON()[declared.id] as typeof initial;
    expect(snapshot).toEqual({ items: ["public"] });
    expect(second.toJSON()[declared.id]).toEqual(snapshot);
    expect(second.toJSON()[declared.id]).not.toBe(snapshot);
    expect(first.exposed()).toEqual({ cart: { items: [] } });
    expect(second.exposed()).toEqual(first.exposed());
    expect(second.exposed().cart).not.toBe(first.exposed().cart);
    expect(Object.isFrozen(snapshot.items)).toBe(true);
    expect(() => snapshot.items.push("changed")).toThrow(TypeError);
    declared.set({ items: ["another-secret"] });
    expect(first.toJSON()).toEqual({
      cart: { items: [] },
      "server-snapshot": { items: ["public"] },
    });
    expect(second.toJSON()).toEqual(first.toJSON());
    expect(declared.get()).toEqual({ items: ["another-secret"] });
    function Value() {
      return <span>{declared.useStore().items.join(",")}</span>;
    }
    expect(renderToString(<Value />)).toBe("<span>public</span>");
  });

  it("registers stores once by id and serialises every one in id order", () => {
    const registry = createStoreRegistry();
    registry.register(entry(theme));
    registry.register(entry(cart));
    registry.register(entry(draft));
    expect(registry.get("cart")).toBe(cart);
    expect(registry.get("missing")).toBeUndefined();
    theme.set("dark");
    expect(registry.toJSON()).toEqual({ cart: { items: [] }, draft: "", theme: "dark" });
    expect(Object.keys(registry.toJSON())).toEqual(["cart", "draft", "theme"]);
    expect(() => registry.register(entry(cart))).toThrow(
      new RexError("REX315", 'rex: store "cart" is already declared; store ids are unique'),
    );
    expect(toJsonValue({ nested: { items: ["fig"] }, skipped: undefined })).toEqual({
      nested: { items: ["fig"] },
    });
  });

  it("snapshots exposed stores only, as frozen JSON copies reused until an exposed change", () => {
    const registry = createStoreRegistry();
    const leaveCart = registry.register(entry(cart));
    const leaveTheme = registry.register(entry(theme));
    const leaveDraft = registry.register(entry(draft));
    const first = registry.exposed();
    expect(first).toEqual({ cart: { items: [] }, theme: "light" });
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.cart).not.toBe(cart.get());
    expect(registry.exposed()).toBe(first);
    draft.set("private");
    expect(registry.exposed()).toBe(first);
    cart.update((current) => ({ items: [...current.items, "fig"] }));
    const second = registry.exposed();
    expect(second).not.toBe(first);
    expect(second).toEqual({ cart: { items: ["fig"] }, theme: "light" });
    leaveCart();
    expect(registry.get("cart")).toBeUndefined();
    expect(registry.exposed()).toEqual({ theme: "light" });
    leaveCart();
    expect(registry.get("theme")).toBe(theme);
    leaveTheme();
    leaveDraft();
    expect(registry.exposed()).toEqual({});
    expect(registry.exposed()).toBe(registry.exposed());
    expect(registry.toJSON()).toEqual({});
  });

  it("notifies subscribers when an exposed store registers, changes or leaves and ignores private ones", () => {
    const registry = createStoreRegistry();
    let notified = 0;
    const unsubscribe = registry.subscribe(() => {
      notified += 1;
    });
    const leaveDraft = registry.register(entry(draft));
    expect(notified).toBe(0);
    const leaveTheme = registry.register(entry(theme));
    expect(notified).toBe(1);
    theme.set("dark");
    expect(notified).toBe(2);
    theme.set("dark");
    draft.set("typed");
    leaveDraft();
    expect(notified).toBe(2);
    leaveTheme();
    expect(notified).toBe(3);
    theme.set("light");
    expect(notified).toBe(3);
    unsubscribe();
    registry.register(entry(cart));
    expect(notified).toBe(3);
  });

  it("leaves the stores unsubscribed when it does not follow them", () => {
    const registry = createStoreRegistry({ follow: false });
    let notified = 0;
    registry.subscribe(() => {
      notified += 1;
    });
    const leaveTheme = registry.register(entry(theme));
    expect(notified).toBe(1);
    expect(registry.exposed()).toEqual({ theme: "light" });
    theme.set("dark");
    expect(notified).toBe(1);
    leaveTheme();
    expect(notified).toBe(2);
    expect(registry.exposed()).toEqual({});
  });
});

describe("useExposedStores", () => {
  function Exposed() {
    return <pre data-testid="exposed">{JSON.stringify(useExposedStores())}</pre>;
  }

  function exposed(): unknown {
    return JSON.parse(screen.getByTestId("exposed").textContent ?? "null");
  }

  it("reads the exposed stores of the app registry and re-renders when one changes", async () => {
    expect(defaultStoreRegistry.get("cart")).toBe(cart);
    expect(defaultStoreRegistry.get("draft")).toBe(draft);
    render(<Exposed />);
    expect(exposed()).toEqual({ cart: { items: [] }, theme: "light" });
    await act(async () => {
      theme.set("dark");
    });
    expect(exposed()).toEqual({ cart: { items: [] }, theme: "dark" });
    await act(async () => {
      draft.set("hidden");
    });
    expect(exposed()).toEqual({ cart: { items: [] }, theme: "dark" });
    await act(async () => {
      resetAll();
    });
    expect(exposed()).toEqual({ cart: { items: [] }, theme: "light" });
  });

  it("reads the registry a provider scopes and only the stores rendered under it", () => {
    function Rendered() {
      theme.useStore();
      return <Exposed />;
    }
    const scoped = createStoreRegistry({ follow: false });
    const html = renderToString(
      <StoreRegistryProvider registry={scoped}>
        <Rendered />
      </StoreRegistryProvider>,
    );
    expect(scoped.get("theme")).toBe(theme);
    expect(scoped.get("cart")).toBeUndefined();
    expect(scoped.exposed()).toEqual({ theme: "light" });
    expect(html).toContain(JSON.stringify({ theme: "light" }).replaceAll('"', "&quot;"));
    const fresh = createStoreRegistry({ follow: false });
    const plain = renderToString(
      <StoreRegistryProvider registry={fresh}>
        <Exposed />
      </StoreRegistryProvider>,
    );
    expect(fresh.exposed()).toEqual({});
    expect(plain).toContain('<pre data-testid="exposed">{}</pre>');
  });

  it("leaves the app registry as the registry outside a provider", () => {
    let seen: unknown = null;
    function Registry() {
      seen = useStoreRegistry();
      theme.useStore();
      return null;
    }
    render(<Registry />);
    expect(seen).toBe(defaultStoreRegistry);
    expect(defaultStoreRegistry.get("theme")).toBe(theme);
  });

  it("is what the store module re-exports", () => {
    expect(createFromStore).toBe(createStoreRegistry);
    expect(defaultFromStore).toBe(defaultStoreRegistry);
    expect(useFromStore).toBe(useExposedStores);
  });
});
