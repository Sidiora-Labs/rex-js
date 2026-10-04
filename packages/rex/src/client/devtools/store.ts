import { createContext, useContext, useSyncExternalStore } from "react";
import type { Outcome } from "../outcome.ts";

export const DEVTOOLS_PANELS = [
  "manifest",
  "page",
  "sidecar",
  "outcomes",
  "queries",
  "renders",
  "audit",
] as const;

export type DevtoolsPanel = (typeof DEVTOOLS_PANELS)[number];

export const OUTCOME_LOG_LIMIT = 200;

export interface OutcomeLogEntry {
  readonly sequence: number;
  readonly page: string;
  readonly outcome: Outcome;
}

export interface RegionRenderStats {
  readonly address: string;
  readonly commits: number;
  readonly lastMs: number;
  readonly totalMs: number;
  readonly maxMs: number;
}

export interface RegionRenderSample {
  readonly address: string;
  readonly durationMs: number;
}

export interface DevtoolsSnapshot {
  readonly open: boolean;
  readonly panel: DevtoolsPanel;
  readonly outcomes: readonly OutcomeLogEntry[];
  readonly renders: readonly RegionRenderStats[];
}

export interface DevtoolsStore {
  snapshot(): DevtoolsSnapshot;
  setOpen(open: boolean): void;
  toggle(): void;
  showPanel(panel: DevtoolsPanel): void;
  recordOutcome(page: string, outcome: Outcome): void;
  recordRenders(samples: readonly RegionRenderSample[]): void;
  subscribe(listener: () => void): () => void;
}

function byAddress(a: RegionRenderStats, b: RegionRenderStats): number {
  return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
}

export function createDevtoolsStore(): DevtoolsStore {
  let state: DevtoolsSnapshot = Object.freeze({
    open: false,
    panel: "manifest",
    outcomes: Object.freeze([]),
    renders: Object.freeze([]),
  });
  let sequence = 0;
  let listeners: readonly (() => void)[] = [];
  let scheduled = false;

  const notify = () => {
    scheduled = false;
    for (const listener of listeners) listener();
  };
  const update = (next: Partial<DevtoolsSnapshot>, deferred = false) => {
    state = Object.freeze({ ...state, ...next });
    if (!deferred) {
      notify();
      return;
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(notify);
  };

  return {
    snapshot: () => state,
    setOpen(open) {
      if (state.open !== open) update({ open });
    },
    toggle() {
      update({ open: !state.open });
    },
    showPanel(panel) {
      if (!(DEVTOOLS_PANELS as readonly string[]).includes(panel)) {
        throw new TypeError(`rex devtools: unknown panel "${String(panel)}"`);
      }
      if (state.panel !== panel) update({ panel });
    },
    recordOutcome(page, outcome) {
      sequence += 1;
      const entry: OutcomeLogEntry = Object.freeze({ sequence, page, outcome });
      update({ outcomes: Object.freeze([...state.outcomes, entry].slice(-OUTCOME_LOG_LIMIT)) });
    },
    recordRenders(samples) {
      if (samples.length === 0) return;
      const stats = new Map(state.renders.map((entry) => [entry.address, entry]));
      for (const { address, durationMs } of samples) {
        if (!Number.isFinite(durationMs) || durationMs < 0) {
          throw new RangeError(`rex devtools: render duration for ${address} must be non-negative`);
        }
        const previous = stats.get(address);
        stats.set(
          address,
          Object.freeze({
            address,
            commits: (previous?.commits ?? 0) + 1,
            lastMs: durationMs,
            totalMs: (previous?.totalMs ?? 0) + durationMs,
            maxMs: Math.max(previous?.maxMs ?? 0, durationMs),
          }),
        );
      }
      update({ renders: Object.freeze([...stats.values()].sort(byAddress)) }, true);
    },
    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
  };
}

export const DevtoolsStoreContext = /* @__PURE__ */ createContext<DevtoolsStore | null>(null);

export function useDevtoolsStore(): DevtoolsStore | null {
  return useContext(DevtoolsStoreContext);
}

export function useDevtoolsSnapshot(store: DevtoolsStore): DevtoolsSnapshot {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}
