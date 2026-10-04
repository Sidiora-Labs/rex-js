import { useSyncExternalStore } from "react";
import { validateName } from "../core/ids.ts";
import { registerReset } from "./reset.ts";

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

export interface StoreRegistry {
  register(entry: RexStore<unknown>): () => void;
  get(id: string): RexStore<unknown> | undefined;
  exposed(): Readonly<Record<string, unknown>>;
  toJSON(): Readonly<Record<string, unknown>>;
  subscribe(listener: Listener): () => void;
}

const EMPTY_STORES: Readonly<Record<string, unknown>> = Object.freeze({});

function describePath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "the value" : path.map(String).join(".");
}

function assertSerialisable(id: string, value: unknown, path: (string | number)[] = []): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(
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
  throw new TypeError(
    `rex: store "${id}" holds a value that does not serialise to JSON at ${describePath(path)}; use plain objects, arrays, strings, finite numbers, booleans and null`,
  );
}

function toJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createStoreRegistry(): StoreRegistry {
  const entries = new Map<string, RexStore<unknown>>();
  const detach = new Map<string, () => void>();
  let listeners: readonly Listener[] = [];
  let snapshot: Readonly<Record<string, unknown>> | null = null;

  const notify = () => {
    snapshot = null;
    for (const listener of listeners) listener();
  };

  return {
    register(entry) {
      if (entries.has(entry.id)) {
        throw new Error(`rex: store "${entry.id}" is already declared; store ids are unique`);
      }
      entries.set(entry.id, entry);
      const unsubscribe = entry.expose ? entry.subscribe(notify) : () => {};
      detach.set(entry.id, unsubscribe);
      if (entry.expose) notify();
      return () => {
        if (entries.get(entry.id) !== entry) return;
        entries.delete(entry.id);
        detach.get(entry.id)?.();
        detach.delete(entry.id);
        if (entry.expose) notify();
      };
    },
    get: (id) => entries.get(id),
    exposed() {
      if (snapshot === null) {
        const shown = [...entries.values()]
          .filter((entry) => entry.expose)
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        snapshot =
          shown.length === 0
            ? EMPTY_STORES
            : Object.freeze(
                Object.fromEntries(shown.map((entry) => [entry.id, toJsonValue(entry.get())])),
              );
      }
      return snapshot;
    },
    toJSON() {
      const all = [...entries.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return Object.fromEntries(all.map((entry) => [entry.id, toJsonValue(entry.get())]));
    },
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
  };
}

export const defaultStoreRegistry: StoreRegistry = createStoreRegistry();

export function store<T>(id: string, options: StoreOptions<T>): RexStore<T> {
  validateName(id, "store id");
  if (typeof options !== "object" || options === null || !("initial" in options)) {
    throw new TypeError(`rex: store "${id}" needs an initial value`);
  }
  const { initial } = options;
  const expose = options.expose ?? false;
  if (typeof expose !== "boolean") {
    throw new TypeError(`rex: store "${id}" expose must be a boolean`);
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
        throw new TypeError(`rex: store "${id}" update takes a function of the current value`);
      }
      set(change(current));
    },
    subscribe,
    useStore(): T {
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

export function useExposedStores(): Readonly<Record<string, unknown>> {
  return useSyncExternalStore(
    defaultStoreRegistry.subscribe,
    defaultStoreRegistry.exposed,
    defaultStoreRegistry.exposed,
  );
}
