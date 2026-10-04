import { use, useEffect, useState, useSyncExternalStore } from "react";
import { APP_OUTCOME_KEY, useOutcomeStore, type Outcome } from "./outcome.ts";
import { useActivePage } from "./router.tsx";

export const LAZY_FAILURE_CODE = "REX326";

export type LazyResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: Error };

export interface LazyModule<T> {
  readonly id: string;
  readonly label: string;
  peek(): LazyResult<T> | null;
  load(): Promise<LazyResult<T>>;
}

export function lazyModule<T>(
  id: string,
  label: string,
  importer: () => Promise<T>,
): LazyModule<T> {
  let result: LazyResult<T> | null = null;
  let pending: Promise<LazyResult<T>> | null = null;
  return {
    id,
    label,
    peek: () => result,
    load() {
      if (result !== null) return Promise.resolve(result);
      if (pending === null) {
        pending = importer().then(
          (value): LazyResult<T> => ({ ok: true, value }),
          (error: unknown): LazyResult<T> => ({
            ok: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        );
        void pending.then((settled) => {
          result = settled;
          pending = null;
        });
      }
      return pending;
    },
  };
}

export function lazyFailureOutcome(module: LazyModule<unknown>, error: Error): Outcome {
  return {
    actionId: module.id,
    ok: false,
    message: `${LAZY_FAILURE_CODE} ${module.label} failed to load: ${error.message}`,
    at: new Date().toISOString(),
  };
}

function subscribeNothing(): () => void {
  return () => {};
}

function clientRendering(): boolean {
  return false;
}

function serverOrHydrating(): boolean {
  return true;
}

export interface LazyModuleOptions {
  readonly active?: boolean;
  readonly suspend?: "always" | "hydration" | "never";
  readonly outcome?: string | null;
  readonly onFailure?: (error: Error) => void;
}

export function useLazyModule<T>(
  module: LazyModule<T>,
  options: LazyModuleOptions = {},
): LazyResult<T> | null {
  const { active = true, suspend = "hydration", outcome = null, onFailure } = options;
  const outcomes = useOutcomeStore();
  const page = useActivePage();
  const key = outcome ?? (page === null ? APP_OUTCOME_KEY : page.page.id);
  const hydrating = useSyncExternalStore(subscribeNothing, clientRendering, serverOrHydrating);
  const [, setSettled] = useState<LazyResult<T> | null>(null);
  let result = module.peek();
  if (
    result === null &&
    active &&
    (suspend === "always" || (suspend === "hydration" && hydrating))
  ) {
    result = use(module.load());
  }

  useEffect(() => {
    if (!active) return;
    let live = true;
    void module.load().then((settled) => {
      if (!live) return;
      setSettled(settled);
      if (settled.ok) return;
      onFailure?.(settled.error);
      void Promise.resolve().then(() => {
        outcomes.set(key, lazyFailureOutcome(module, settled.error));
      });
    });
    return () => {
      live = false;
    };
  }, [active, key, module, onFailure, outcomes]);

  return active ? result : null;
}
