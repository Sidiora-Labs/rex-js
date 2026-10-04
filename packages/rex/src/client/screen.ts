import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  REX_POINTERS,
  REX_SCREENS,
  REX_SCREEN_DENSITIES,
  type RexPointer,
  type RexScreen,
  type RexScreenDensity,
} from "../manifest/types.ts";
import type { ShellNavForm, ShellSheetForm } from "./shell/components.ts";

export { REX_POINTERS, REX_SCREENS, REX_SCREEN_DENSITIES };
export type { RexPointer, RexScreen, RexScreenDensity };

export const SCREEN_ATTRIBUTES = Object.freeze({
  screen: "data-rex-screen",
  pointer: "data-rex-pointer",
  density: "data-rex-density",
} as const);

export const SCREEN_ATTRIBUTE = SCREEN_ATTRIBUTES.screen;
export const POINTER_ATTRIBUTE = SCREEN_ATTRIBUTES.pointer;

export const SCREEN_BREAKPOINTS = Object.freeze({
  phone: 600,
  tablet: 1024,
  desktop: 1600,
} as const);

export const SCREEN_QUERIES: Readonly<Record<RexScreen, string>> = Object.freeze({
  phone: `(max-width: ${SCREEN_BREAKPOINTS.phone - 0.02}px)`,
  tablet: `(min-width: ${SCREEN_BREAKPOINTS.phone}px) and (max-width: ${SCREEN_BREAKPOINTS.tablet - 0.02}px)`,
  desktop: `(min-width: ${SCREEN_BREAKPOINTS.tablet}px) and (max-width: ${SCREEN_BREAKPOINTS.desktop - 0.02}px)`,
  wide: `(min-width: ${SCREEN_BREAKPOINTS.desktop}px)`,
});

export const COARSE_POINTER_QUERY = "(pointer: coarse)";

export const DEFAULT_SCREEN: RexScreen = "desktop";
export const DEFAULT_POINTER: RexPointer = "fine";
export const DEFAULT_SCREEN_DENSITY: RexScreenDensity = "comfortable";

export function isRexScreen(value: unknown): value is RexScreen {
  return typeof value === "string" && (REX_SCREENS as readonly string[]).includes(value);
}

export function isRexPointer(value: unknown): value is RexPointer {
  return typeof value === "string" && (REX_POINTERS as readonly string[]).includes(value);
}

export function isRexScreenDensity(value: unknown): value is RexScreenDensity {
  return typeof value === "string" && (REX_SCREEN_DENSITIES as readonly string[]).includes(value);
}

export function classifyScreen(width: number): RexScreen {
  if (width < SCREEN_BREAKPOINTS.phone) return "phone";
  if (width < SCREEN_BREAKPOINTS.tablet) return "tablet";
  if (width < SCREEN_BREAKPOINTS.desktop) return "desktop";
  return "wide";
}

export function classifyPointer(coarse: boolean): RexPointer {
  return coarse ? "coarse" : "fine";
}

export function screenDensity(preference: string | null | undefined): RexScreenDensity {
  if (preference === "agent") return "agent";
  if (preference === "compact") return "compact";
  return DEFAULT_SCREEN_DENSITY;
}

export function sheetFormFor(screen: RexScreen): ShellSheetForm {
  return screen === "phone" ? "bottom-sheet" : "dialog";
}

export function navFormFor(screen: RexScreen): ShellNavForm {
  if (screen === "phone") return "dock";
  return screen === "tablet" ? "bar" : "sidebar";
}

export interface ScreenSnapshot {
  readonly screen: RexScreen;
  readonly pointer: RexPointer;
}

export interface ScreenState extends ScreenSnapshot {
  readonly density: RexScreenDensity;
}

export type MatchMedia = (query: string) => MediaQueryList;

export type ResizeObserverConstructor = new (callback: ResizeObserverCallback) => ResizeObserver;

export interface ScreenSource {
  get(): ScreenSnapshot;
  subscribe(listener: () => void): () => void;
}

export interface ScreenSourceOptions {
  readonly matchMedia?: MatchMedia;
  readonly ResizeObserver?: ResizeObserverConstructor;
  readonly root?: Element;
  readonly width?: () => number;
}

const DEFAULT_SNAPSHOT: ScreenSnapshot = Object.freeze({
  screen: DEFAULT_SCREEN,
  pointer: DEFAULT_POINTER,
});

interface ScreenQueries {
  readonly screens: readonly (readonly [RexScreen, MediaQueryList])[];
  readonly pointer: MediaQueryList;
}

function browserMatchMedia(): MatchMedia | undefined {
  const view = globalThis.window;
  if (view === undefined || typeof view.matchMedia !== "function") return undefined;
  return (query) => view.matchMedia(query);
}

function viewportWidth(): number {
  return globalThis.window?.innerWidth ?? Number.NaN;
}

export function createScreenSource(options: ScreenSourceOptions = {}): ScreenSource {
  const media = options.matchMedia ?? browserMatchMedia();
  const width = options.width ?? viewportWidth;
  let queries: ScreenQueries | null = null;
  let snapshot: ScreenSnapshot | null = null;
  let detach: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function lists(): ScreenQueries | null {
    if (media === undefined) return null;
    queries ??= {
      screens: REX_SCREENS.map((screen) => [screen, media(SCREEN_QUERIES[screen])] as const),
      pointer: media(COARSE_POINTER_QUERY),
    };
    return queries;
  }

  function measure(): ScreenSnapshot {
    const current = lists();
    const matched = current?.screens.find(([, list]) => list.matches)?.[0];
    const measured = width();
    const screen =
      matched ?? (Number.isFinite(measured) ? classifyScreen(measured) : DEFAULT_SCREEN);
    const pointer = current === null ? DEFAULT_POINTER : classifyPointer(current.pointer.matches);
    return screen === DEFAULT_SNAPSHOT.screen && pointer === DEFAULT_SNAPSHOT.pointer
      ? DEFAULT_SNAPSHOT
      : Object.freeze({ screen, pointer });
  }

  function refresh(): void {
    const next = measure();
    const previous = snapshot;
    if (previous !== null && next.screen === previous.screen && next.pointer === previous.pointer) {
      return;
    }
    snapshot = next;
    if (previous === null) return;
    for (const listener of [...listeners]) listener();
  }

  function attach(): () => void {
    const current = lists();
    const all =
      current === null ? [] : [...current.screens.map(([, list]) => list), current.pointer];
    for (const list of all) list.addEventListener("change", refresh);
    const Observer = options.ResizeObserver ?? globalThis.ResizeObserver;
    const target = options.root ?? globalThis.document?.documentElement;
    let observer: ResizeObserver | null = null;
    if (Observer !== undefined && target !== undefined) {
      observer = new Observer(() => refresh());
      observer.observe(target);
    }
    return () => {
      for (const list of all) list.removeEventListener("change", refresh);
      observer?.disconnect();
    };
  }

  return {
    get() {
      snapshot ??= measure();
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (detach === null) {
        detach = attach();
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && detach !== null) {
          detach();
          detach = null;
        }
      };
    },
  };
}

let browserScreenSource: ScreenSource | null = null;

export function defaultScreenSource(): ScreenSource {
  browserScreenSource ??= createScreenSource();
  return browserScreenSource;
}

export function readRootScreen(root: Element | null | undefined): ScreenState | null {
  if (root === null || root === undefined) return null;
  const screen = root.getAttribute(SCREEN_ATTRIBUTE);
  const pointer = root.getAttribute(POINTER_ATTRIBUTE);
  const density = root.getAttribute(SCREEN_ATTRIBUTES.density);
  if (!isRexScreen(screen) || !isRexPointer(pointer) || !isRexScreenDensity(density)) return null;
  return Object.freeze({ screen, pointer, density });
}

export function screenAttributes(state: ScreenState): Readonly<Record<string, string>> {
  return {
    [SCREEN_ATTRIBUTE]: state.screen,
    [POINTER_ATTRIBUTE]: state.pointer,
    [SCREEN_ATTRIBUTES.density]: state.density,
  };
}

export const ScreenSeedContext = createContext<ScreenState | null>(null);
ScreenSeedContext.displayName = "RexScreenSeed";

export const ScreenContext = createContext<ScreenState | null>(null);
ScreenContext.displayName = "RexScreen";

function subscribeNothing(): () => void {
  return () => {};
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

function sameState(a: ScreenState, b: ScreenSnapshot, density: RexScreenDensity): boolean {
  return a.screen === b.screen && a.pointer === b.pointer && a.density === density;
}

export interface ScreenProviderProps {
  readonly children?: ReactNode;
  readonly density: RexScreenDensity;
  readonly source?: ScreenSource;
  readonly root?: HTMLElement;
}

export function ScreenProvider({ children, density, source, root }: ScreenProviderProps) {
  const seed = useContext(ScreenSeedContext);
  const active = source ?? defaultScreenSource();
  const [initial] = useState<ScreenState | null>(
    () => seed ?? readRootScreen(root ?? globalThis.document?.documentElement),
  );
  const hydrated = useHydrated();
  const live = useSyncExternalStore(active.subscribe, active.get, active.get);
  const current = !hydrated && initial !== null ? initial : null;

  const value = useMemo<ScreenState>(() => {
    if (current !== null) return current;
    if (initial !== null && sameState(initial, live, density)) return initial;
    return Object.freeze({ screen: live.screen, pointer: live.pointer, density });
  }, [current, initial, live, density]);

  useLayoutEffect(() => {
    const element = root ?? globalThis.document?.documentElement;
    if (element === undefined) return;
    const previous = {
      screen: element.getAttribute(SCREEN_ATTRIBUTE),
      pointer: element.getAttribute(POINTER_ATTRIBUTE),
    };
    element.setAttribute(SCREEN_ATTRIBUTE, value.screen);
    element.setAttribute(POINTER_ATTRIBUTE, value.pointer);
    return () => {
      for (const [name, prior] of [
        [SCREEN_ATTRIBUTE, previous.screen],
        [POINTER_ATTRIBUTE, previous.pointer],
      ] as const) {
        if (prior === null) element.removeAttribute(name);
        else element.setAttribute(name, prior);
      }
    };
  }, [value.screen, value.pointer, root]);

  return createElement(ScreenContext.Provider, { value }, children);
}

export function useScreen(): ScreenState {
  const provided = useContext(ScreenContext);
  const seed = useContext(ScreenSeedContext);
  const source = defaultScreenSource();
  const live = useSyncExternalStore(
    provided === null ? source.subscribe : subscribeNothing,
    source.get,
    () => seed ?? source.get(),
  );
  return useMemo<ScreenState>(
    () =>
      provided ??
      Object.freeze({
        screen: live.screen,
        pointer: live.pointer,
        density: seed?.density ?? DEFAULT_SCREEN_DENSITY,
      }),
    [provided, live, seed],
  );
}
