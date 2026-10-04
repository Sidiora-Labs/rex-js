import { useSyncExternalStore } from "react";
import { RexError } from "../core/errors.ts";
import { validateName } from "../core/ids.ts";
import { registerReset } from "./reset.ts";
import { defaultStoreRegistry, toJsonValue, useRenderedStore } from "./store-registry.ts";

export {
  createStoreRegistry,
  defaultStoreRegistry,
  useExposedStores,
  type StoreRegistry,
} from "./store-registry.ts";

type Listener = () => void;

export interface StoreOptions<T> {
  readonly initial: T;
  readonly expose?: boolean;
}

export interface RexStore<T> {
  readonly id: string;
  readonly expose: boolean;
  get(): T;
  set(next: T): void;
  update(change: (current: T) => T): void;
  subscribe(listener: Listener): () => void;
  useStore(): T;
  reset(): void;
  toJSON(): T;
}

export type StoreValue<S> = S extends RexStore<infer T> ? T : never;

function describePath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "the value" : path.map(String).join(".");
}

function assertSerialisable(id: string, value: unknown, path: (string | number)[] = []): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new RexError(
      "REX315",
      `rex: store "${id}" holds a non-finite number at ${describePath(path)}; store values serialise to JSON`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSerialisable(id, item, [...path, index]));
    return;
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value) as unknown;
    if (proto === Object.prototype || proto === null) {
      for (const [key, item] of Object.entries(value)) {
        assertSerialisable(id, item, [...path, key]);
      }
      return;
    }
  }
  throw new RexError(
    "REX315",
    `rex: store "${id}" holds a value that does not serialise to JSON at ${describePath(path)}; use plain objects, arrays, strings, finite numbers, booleans and null`,
  );
}

export function store<T>(id: string, options: StoreOptions<T>): RexStore<T> {
  validateName(id, "store id");
  if (typeof options !== "object" || options === null || !("initial" in options)) {
    throw new RexError("REX315", `rex: store "${id}" needs an initial value`);
  }
  const { initial } = options;
  const expose = options.expose ?? false;
  if (typeof expose !== "boolean") {
    throw new RexError("REX315", `rex: store "${id}" expose must be a boolean`);
  }
  assertSerialisable(id, initial);

  let current = initial;
  let listeners: readonly Listener[] = [];

  const get = (): T => current;
  const subscribe = (listener: Listener): (() => void) => {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  };
  const set = (next: T): void => {
    if (Object.is(next, current)) return;
    assertSerialisable(id, next);
    current = next;
    for (const listener of listeners) listener();
  };

  const created: RexStore<T> = Object.freeze({
    id,
    expose,
    get,
    set,
    update(change: (value: T) => T) {
      if (typeof change !== "function") {
        throw new RexError(
          "REX315",
          `rex: store "${id}" update takes a function of the current value`,
        );
      }
      set(change(current));
    },
    subscribe,
    useStore(): T {
      useRenderedStore(created as RexStore<unknown>);
      return useSyncExternalStore(subscribe, get, () => initial);
    },
    reset() {
      set(initial);
    },
    toJSON: (): T => toJsonValue(current),
  });

  defaultStoreRegistry.register(created as RexStore<unknown>);
  registerReset(created.reset);
  return created;
}

export function storesToJSON(): Readonly<Record<string, unknown>> {
  return defaultStoreRegistry.toJSON();
}
