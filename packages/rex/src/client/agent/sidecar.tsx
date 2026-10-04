import {
  createContext,
  createElement,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ActionEffect, AnyAction } from "../../core/action.ts";
import type { Actor } from "../../core/actor.ts";
import type { AnyPage } from "../../core/page.ts";
import { evaluate } from "../../core/policy.ts";
import type { JsonSchema } from "../../core/schema.ts";
import { escapeInlineJson } from "../../core/serialize.ts";
import type { RexDataState } from "../../core/states.ts";
import {
  INVOCATION_ROUTES,
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  SIDECAR_VERSION,
  type InvocationRoute,
  type SidecarAction,
  type SidecarOutcome,
  type SidecarOverlay,
  type SidecarPayload,
} from "../../manifest/sidecar.schema.ts";
import { actionLabel } from "../act.ts";
import { useActor } from "../context.ts";
import { useOutcome, type Outcome } from "../outcome.ts";
import { PageRuntimeContext, usePageQueries } from "../page.tsx";
import { useActivePage, type PageResolution } from "../router.tsx";
import { useDataState } from "../states.ts";

declare global {
  interface Window {
    __rex?: SidecarPayload;
  }
}

type Listener = () => void;

function listenerSet() {
  let listeners: readonly Listener[] = [];
  return {
    notify() {
      for (const listener of listeners) listener();
    },
    subscribe(listener: Listener): () => void {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((item) => item !== listener);
      };
    },
  };
}

export interface OverlayRegistry {
  isOpen(page: string, overlay: string): boolean;
  setOpen(page: string, overlay: string, open: boolean): void;
  openOverlays(page: string): readonly string[];
  subscribe(listener: Listener): () => void;
}

export function createOverlayRegistry(): OverlayRegistry {
  const open = new Map<string, ReadonlySet<string>>();
  const snapshots = new Map<string, readonly string[]>();
  const listeners = listenerSet();
  return {
    isOpen: (page, overlay) => open.get(page)?.has(overlay) ?? false,
    setOpen(page, overlay, next) {
      const current = open.get(page) ?? new Set<string>();
      if (current.has(overlay) === next) return;
      const updated = new Set(current);
      if (next) updated.add(overlay);
      else updated.delete(overlay);
      open.set(page, updated);
      snapshots.delete(page);
      listeners.notify();
    },
    openOverlays(page) {
      let snapshot = snapshots.get(page);
      if (snapshot === undefined) {
        snapshot = Object.freeze([...(open.get(page) ?? [])].sort());
        snapshots.set(page, snapshot);
      }
      return snapshot;
    },
    subscribe: listeners.subscribe,
  };
}

export const defaultOverlayRegistry: OverlayRegistry = createOverlayRegistry();

export const OverlayRegistryContext = createContext<OverlayRegistry>(defaultOverlayRegistry);
OverlayRegistryContext.displayName = "RexOverlayRegistry";

export interface OverlayRegistryProviderProps {
  readonly registry: OverlayRegistry;
  readonly children?: ReactNode;
}

export function OverlayRegistryProvider({ registry, children }: OverlayRegistryProviderProps) {
  return createElement(OverlayRegistryContext.Provider, { value: registry }, children);
}

export function useOverlayRegistry(): OverlayRegistry {
  return useContext(OverlayRegistryContext);
}

export function useOpenOverlays(page: string): readonly string[] {
  const registry = useOverlayRegistry();
  return useSyncExternalStore(
    registry.subscribe,
    () => registry.openOverlays(page),
    () => registry.openOverlays(page),
  );
}

export interface Affordance {
  readonly id: string;
  readonly label: string;
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly effect: ActionEffect;
  readonly input: JsonSchema;
  readonly via: readonly InvocationRoute[];
  invoke(input: unknown): Promise<unknown>;
}

export interface AffordanceRegistry {
  register(page: string, entries: readonly Affordance[]): () => void;
  list(page: string): readonly Affordance[];
  subscribe(listener: Listener): () => void;
}

const EMPTY_AFFORDANCES: readonly Affordance[] = Object.freeze([]);

export function createAffordanceRegistry(): AffordanceRegistry {
  const byPage = new Map<string, Map<string, Affordance>>();
  const snapshots = new Map<string, readonly Affordance[]>();
  const listeners = listenerSet();
  return {
    register(page, entries) {
      const bucket = byPage.get(page) ?? new Map<string, Affordance>();
      for (const entry of entries) {
        if (bucket.has(entry.id)) {
          throw new Error(`rex: affordance "${entry.id}" is already registered on page "${page}"`);
        }
      }
      for (const entry of entries) bucket.set(entry.id, entry);
      byPage.set(page, bucket);
      snapshots.delete(page);
      listeners.notify();
      return () => {
        let changed = false;
        for (const entry of entries) {
          if (bucket.get(entry.id) === entry) {
            bucket.delete(entry.id);
            changed = true;
          }
        }
        if (changed) {
          snapshots.delete(page);
          listeners.notify();
        }
      };
    },
    list(page) {
      let snapshot = snapshots.get(page);
      if (snapshot === undefined) {
        const bucket = byPage.get(page);
        snapshot =
          bucket === undefined || bucket.size === 0
            ? EMPTY_AFFORDANCES
            : Object.freeze(
                [...bucket.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
              );
        snapshots.set(page, snapshot);
      }
      return snapshot;
    },
    subscribe: listeners.subscribe,
  };
}

export const defaultAffordanceRegistry: AffordanceRegistry = createAffordanceRegistry();

export const AffordanceRegistryContext =
  createContext<AffordanceRegistry>(defaultAffordanceRegistry);
AffordanceRegistryContext.displayName = "RexAffordanceRegistry";

export interface AffordanceRegistryProviderProps {
  readonly registry: AffordanceRegistry;
  readonly children?: ReactNode;
}

export function AffordanceRegistryProvider({
  registry,
  children,
}: AffordanceRegistryProviderProps) {
  return createElement(AffordanceRegistryContext.Provider, { value: registry }, children);
}

export function useAffordanceRegistry(): AffordanceRegistry {
  return useContext(AffordanceRegistryContext);
}

export function useAffordances(page: string): readonly Affordance[] {
  const registry = useAffordanceRegistry();
  return useSyncExternalStore(
    registry.subscribe,
    () => registry.list(page),
    () => registry.list(page),
  );
}

export function useRegisterAffordances(page: string | null, entries: readonly Affordance[]): void {
  const registry = useAffordanceRegistry();
  useLayoutEffect(() => {
    if (page === null || entries.length === 0) return;
    return registry.register(page, entries);
  }, [registry, page, entries]);
}

export function actionRoutes(declared: AnyAction): readonly InvocationRoute[] {
  return INVOCATION_ROUTES.filter((route) => route !== "key" || declared.shortcut !== null);
}

export function sidecarAction(declared: AnyAction, subject: Actor): SidecarAction {
  const decision = evaluate(declared.policy, subject);
  return {
    id: declared.id,
    label: actionLabel(declared),
    allowed: decision.allowed,
    reason: decision.reason,
    effect: declared.effect,
    input: declared.inputJsonSchema,
    via: [...actionRoutes(declared)],
  };
}

export function sidecarOutcome(outcome: Outcome | null): SidecarOutcome | null {
  if (outcome === null) return null;
  return { action: outcome.actionId, ok: outcome.ok, message: outcome.message, at: outcome.at };
}

export interface SidecarSource {
  readonly page: AnyPage;
  readonly params: Readonly<Record<string, unknown>>;
  readonly state: RexDataState;
  readonly actor: Actor;
  readonly openOverlays: readonly string[];
  readonly affordances?: readonly Affordance[];
  readonly outcome: Outcome | null;
}

function jsonParams(params: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
}

export function buildSidecarPayload(source: SidecarSource): SidecarPayload {
  const declared = source.page;
  const actions: SidecarAction[] = declared.actions.map((entry) =>
    sidecarAction(entry, source.actor),
  );
  const ids = new Set(actions.map((entry) => entry.id));
  for (const affordance of source.affordances ?? []) {
    if (ids.has(affordance.id)) {
      throw new Error(
        `rex: affordance "${affordance.id}" collides with an action of page "${declared.id}"`,
      );
    }
    ids.add(affordance.id);
    if (!affordance.allowed && affordance.reason === null) {
      throw new Error(`rex: disallowed affordance "${affordance.id}" must state its reason`);
    }
    actions.push({
      id: affordance.id,
      label: affordance.label,
      allowed: affordance.allowed,
      reason: affordance.allowed ? null : affordance.reason,
      effect: affordance.effect,
      input: affordance.input,
      via: INVOCATION_ROUTES.filter((route) => affordance.via.includes(route)),
    });
  }
  const overlays: SidecarOverlay[] = declared.overlays.map((overlay) => ({
    id: overlay.id,
    open: source.openOverlays.includes(overlay.id),
    dismiss: overlay.dismiss,
  }));
  return {
    version: SIDECAR_VERSION,
    page: declared.id,
    params: jsonParams(source.params),
    state: source.state,
    actions,
    overlays,
    outcome: sidecarOutcome(source.outcome),
  };
}

export function usePageDataState(resolution: PageResolution): RexDataState {
  const runtime = useContext(PageRuntimeContext);
  const scope = `${resolution.page.id}:${JSON.stringify(resolution.params)}`;
  const queries = usePageQueries(scope);
  const dataState = useDataState(
    queries.map((query) => query.state),
    { policy: resolution.policy },
  );
  if (runtime !== null && runtime.page === resolution.page) return runtime.state;
  const invalid = resolution.policy.allowed && resolution.issues.length > 0;
  return invalid ? "terminal-error" : dataState;
}

export function useSidecarPayload(resolution: PageResolution): SidecarPayload {
  const subject = useActor();
  const state = usePageDataState(resolution);
  const openOverlays = useOpenOverlays(resolution.page.id);
  const affordances = useAffordances(resolution.page.id);
  const outcome = useOutcome(resolution.page.id);
  return useMemo(
    () =>
      buildSidecarPayload({
        page: resolution.page,
        params: resolution.params,
        state,
        actor: subject,
        openOverlays,
        affordances,
        outcome,
      }),
    [resolution, state, subject, openOverlays, affordances, outcome],
  );
}

export function serializeSidecar(payload: SidecarPayload): string {
  return escapeInlineJson(payload);
}

let sidecarOwner: string | null = null;

function ActiveSidecar({ resolution }: { readonly resolution: PageResolution }) {
  const owner = useId();
  const payload = useSidecarPayload(resolution);
  const serialized = useMemo(() => serializeSidecar(payload), [payload]);

  useLayoutEffect(() => {
    if (sidecarOwner !== null && sidecarOwner !== owner) {
      throw new Error("rex: a page renders exactly one RexSidecar; another one is mounted");
    }
    sidecarOwner = owner;
    return () => {
      if (sidecarOwner === owner) sidecarOwner = null;
    };
  }, [owner]);

  useLayoutEffect(() => {
    const target = globalThis.window;
    if (target === undefined) return;
    target.__rex = payload;
    return () => {
      if (target.__rex === payload) delete target.__rex;
    };
  }, [payload]);

  return (
    <script
      type={SIDECAR_MIME_TYPE}
      id={SIDECAR_ELEMENT_ID}
      data-rex-sidecar={payload.page}
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
}

export function RexSidecar() {
  const resolution = useActivePage();
  if (resolution === null) return null;
  return <ActiveSidecar resolution={resolution} />;
}

export function readSidecar(root: ParentNode = globalThis.document): unknown {
  const elements = root.querySelectorAll(
    `script[type="${SIDECAR_MIME_TYPE}"]#${SIDECAR_ELEMENT_ID}`,
  );
  if (elements.length !== 1) {
    throw new Error(`rex: expected exactly one sidecar element, found ${elements.length}`);
  }
  return JSON.parse((elements[0] as Element).textContent ?? "") as unknown;
}
