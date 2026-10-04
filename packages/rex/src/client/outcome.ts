import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { RexError } from "../core/errors.ts";

export const APP_OUTCOME_KEY = "app";

export interface Outcome {
  readonly actionId: string;
  readonly ok: boolean;
  readonly message: string;
  readonly at: string;
}

export interface OutcomeStore {
  get(page: string): Outcome | null;
  set(page: string, outcome: Outcome): void;
  clear(page: string): void;
  subscribe(listener: () => void): () => void;
}

export function createOutcomeStore(): OutcomeStore {
  const outcomes = new Map<string, Outcome>();
  let listeners: readonly (() => void)[] = [];
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (page) => outcomes.get(page) ?? null,
    set(page, outcome) {
      if (typeof outcome.actionId !== "string" || outcome.actionId.length === 0) {
        throw new RexError("REX322", "outcome: actionId must be a non-empty string");
      }
      if (Number.isNaN(Date.parse(outcome.at))) {
        throw new RexError("REX322", "outcome: at must be an ISO timestamp");
      }
      outcomes.set(page, Object.freeze({ ...outcome }));
      notify();
    },
    clear(page) {
      if (outcomes.delete(page)) notify();
    },
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
  };
}

export const defaultOutcomeStore: OutcomeStore = createOutcomeStore();

export const OutcomeStoreContext = createContext<OutcomeStore>(defaultOutcomeStore);
OutcomeStoreContext.displayName = "RexOutcomeStore";

export interface OutcomeProviderProps {
  readonly store: OutcomeStore;
  readonly children?: ReactNode;
}

export function OutcomeProvider({ store, children }: OutcomeProviderProps) {
  return createElement(OutcomeStoreContext.Provider, { value: store }, children);
}

export function useOutcomeStore(): OutcomeStore {
  return useContext(OutcomeStoreContext);
}

export function useOutcome(page: string): Outcome | null {
  const store = useOutcomeStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(page),
    () => store.get(page),
  );
}
