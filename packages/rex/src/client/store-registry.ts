import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { RexError } from "../core/errors.ts";
import type { RexStore } from "./store.ts";

type Listener = () => void;

export interface StoreRegistry {
  register(entry: RexStore<unknown>): () => void;
  get(id: string): RexStore<unknown> | undefined;
  exposed(): Readonly<Record<string, unknown>>;
  toJSON(): Readonly<Record<string, unknown>>;
  subscribe(listener: Listener): () => void;
}

const EMPTY_STORES: Readonly<Record<string, unknown>> = Object.freeze({});

export function toJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface StoreRegistryOptions {
  readonly follow?: boolean;
}

export function createStoreRegistry(options: StoreRegistryOptions = {}): StoreRegistry {
  const follow = options.follow ?? true;
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
        throw new RexError(
          "REX315",
          `rex: store "${entry.id}" is already declared; store ids are unique`,
        );
      }
      entries.set(entry.id, entry);
      const unsubscribe = follow && entry.expose ? entry.subscribe(notify) : () => {};
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

export const StoreRegistryContext = createContext<StoreRegistry>(defaultStoreRegistry);
StoreRegistryContext.displayName = "RexStoreRegistry";

export interface StoreRegistryProviderProps {
  readonly registry: StoreRegistry;
  readonly children?: ReactNode;
}

export function StoreRegistryProvider({ registry, children }: StoreRegistryProviderProps) {
  return createElement(StoreRegistryContext.Provider, { value: registry }, children);
}

export function useStoreRegistry(): StoreRegistry {
  return useContext(StoreRegistryContext);
}

export function useRenderedStore(entry: RexStore<unknown>): void {
  const registry = useStoreRegistry();
  if (registry !== defaultStoreRegistry && registry.get(entry.id) !== entry) {
    registry.register(entry);
  }
}

export function useExposedStores(): Readonly<Record<string, unknown>> {
  const registry = useStoreRegistry();
  return useSyncExternalStore(registry.subscribe, registry.exposed, registry.exposed);
}
