import {
  Profiler,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from "react";
import { RexRuntimeContext } from "../context.ts";
import { APP_OUTCOME_KEY, useOutcomeStore, type Outcome, type OutcomeStore } from "../outcome.ts";
import { regionRenderSamples } from "./profiler.ts";
import { DevtoolsStoreContext, createDevtoolsStore, type DevtoolsStore } from "./store.ts";

export const DEVTOOLS_PROFILER_ID = "rex-devtools";

export interface DevtoolsProviderProps {
  readonly children: ReactNode;
  readonly store?: DevtoolsStore;
}

export function watchOutcomes(
  outcomes: OutcomeStore,
  store: DevtoolsStore,
  keys: () => readonly string[],
): () => void {
  const seen = new Map<string, Outcome>();
  const scan = () => {
    for (const key of keys()) {
      const outcome = outcomes.get(key);
      if (outcome === null || seen.get(key) === outcome) continue;
      seen.set(key, outcome);
      store.recordOutcome(key, outcome);
    }
  };
  scan();
  return outcomes.subscribe(scan);
}

export function DevtoolsProvider({ children, store: provided }: DevtoolsProviderProps) {
  const [store] = useState(() => provided ?? createDevtoolsStore());
  const outcomes = useOutcomeStore();
  const runtime = useContext(RexRuntimeContext);
  const registry = runtime?.registry ?? null;

  useLayoutEffect(
    () =>
      watchOutcomes(outcomes, store, () => [
        APP_OUTCOME_KEY,
        ...(registry === null ? [] : registry.pages.map((declared) => declared.id)),
      ]),
    [outcomes, store, registry],
  );

  const onRender = useCallback<ProfilerOnRenderCallback>(
    (_id, _phase, _actualDuration, _baseDuration, startTime) => {
      const document = globalThis.document;
      if (document === undefined) return;
      store.recordRenders(regionRenderSamples(document, startTime));
    },
    [store],
  );

  return (
    <DevtoolsStoreContext.Provider value={store}>
      <Profiler id={DEVTOOLS_PROFILER_ID} onRender={onRender}>
        {children}
      </Profiler>
    </DevtoolsStoreContext.Provider>
  );
}
