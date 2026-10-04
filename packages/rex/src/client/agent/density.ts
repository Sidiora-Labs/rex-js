import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RexError } from "../../core/errors.ts";
import {
  DEFAULT_DENSITY,
  REX_DENSITIES,
  REX_DENSITY_HEADER,
  type RexDensity,
} from "../../core/protocol.ts";
import { RexRuntimeContext } from "../context.ts";
import {
  REX_SCREEN_DENSITIES,
  SCREEN_ATTRIBUTES,
  ScreenProvider,
  screenDensity,
  type RexScreenDensity,
  type ScreenSource,
} from "../screen.ts";

export type { RexDensity };

export const DENSITY_QUERY_KEY = "density";
export const DENSITY_STORAGE_KEY = "rex:density";
export const DENSITY_ATTRIBUTE = SCREEN_ATTRIBUTES.density;
export const DENSITY_HEADER = REX_DENSITY_HEADER;

export const DENSITY_PREFERENCES: readonly DensityPreference[] = Object.freeze([
  ...REX_DENSITIES,
  ...REX_SCREEN_DENSITIES.filter(
    (density): density is Exclude<RexScreenDensity, RexDensity> =>
      !(REX_DENSITIES as readonly string[]).includes(density),
  ),
]);

export type DensityPreference = RexDensity | RexScreenDensity;

export function isDensityPreference(value: unknown): value is DensityPreference {
  return typeof value === "string" && (DENSITY_PREFERENCES as readonly string[]).includes(value);
}

export type DensitySource = "query" | "header" | "stored" | "default" | "set";

export interface DensityInputs {
  readonly query?: string | null;
  readonly header?: string | null;
  readonly stored?: string | null;
  readonly fallback?: DensityPreference;
}

export interface ResolvedDensity {
  readonly density: DensityPreference;
  readonly source: DensitySource;
}

export function densityFromSearch(search: string): string | null {
  return new URLSearchParams(search).get(DENSITY_QUERY_KEY);
}

export function resolveDensity(inputs: DensityInputs): ResolvedDensity {
  if (isDensityPreference(inputs.query)) return { density: inputs.query, source: "query" };
  if (isDensityPreference(inputs.header)) return { density: inputs.header, source: "header" };
  if (isDensityPreference(inputs.stored)) return { density: inputs.stored, source: "stored" };
  return { density: inputs.fallback ?? DEFAULT_DENSITY, source: "default" };
}

export function readStoredDensity(): string | null {
  try {
    return globalThis.localStorage?.getItem(DENSITY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredDensity(density: DensityPreference): void {
  try {
    globalThis.localStorage?.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    return;
  }
}

export function expandCollapsedGroups(root: ParentNode): number {
  let expanded = 0;
  for (const group of root.querySelectorAll("details:not([open])")) {
    group.setAttribute("open", "");
    expanded += 1;
  }
  return expanded;
}

export interface DensityValue extends ResolvedDensity {
  readonly screenDensity: RexScreenDensity;
  setDensity(density: DensityPreference): void;
}

export const DensityContext = createContext<DensityValue | null>(null);
DensityContext.displayName = "RexDensity";

export interface DensityProviderProps {
  readonly children?: ReactNode;
  readonly search?: string;
  readonly header?: string | null;
  readonly root?: HTMLElement;
  readonly fallback?: DensityPreference;
  readonly screen?: ScreenSource;
}

export function DensityProvider({
  children,
  search,
  header,
  root,
  fallback,
  screen,
}: DensityProviderProps) {
  const runtime = useContext(RexRuntimeContext);
  const query = densityFromSearch(search ?? globalThis.location?.search ?? "");
  const headerValue = header !== undefined ? header : (runtime?.density ?? null);
  const [chosen, setChosen] = useState<DensityPreference | null>(null);
  const [stored] = useState(readStoredDensity);

  const resolved = useMemo<ResolvedDensity>(
    () =>
      chosen !== null
        ? { density: chosen, source: "set" }
        : resolveDensity(
            fallback === undefined
              ? { query, header: headerValue, stored }
              : { query, header: headerValue, stored, fallback },
          ),
    [chosen, query, headerValue, stored, fallback],
  );
  const fitted = screenDensity(resolved.density);

  const setDensity = useCallback((density: DensityPreference) => {
    if (!isDensityPreference(density)) {
      throw new RexError(
        "REX321",
        `rex: density must be one of ${DENSITY_PREFERENCES.join(", ")}, received ${String(density)}`,
      );
    }
    writeStoredDensity(density);
    setChosen(density);
  }, []);

  useLayoutEffect(() => {
    const element = root ?? globalThis.document?.documentElement;
    if (element === undefined) return;
    const previous = element.getAttribute(DENSITY_ATTRIBUTE);
    element.setAttribute(DENSITY_ATTRIBUTE, fitted);
    return () => {
      if (previous === null) element.removeAttribute(DENSITY_ATTRIBUTE);
      else element.setAttribute(DENSITY_ATTRIBUTE, previous);
    };
  }, [fitted, root]);

  useLayoutEffect(() => {
    const element = root ?? globalThis.document?.documentElement;
    if (element === undefined || fitted !== "agent") return;
    expandCollapsedGroups(element);
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      expandCollapsedGroups(element);
    });
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [fitted, root]);

  const value = useMemo<DensityValue>(
    () => ({ ...resolved, screenDensity: fitted, setDensity }),
    [resolved, fitted, setDensity],
  );
  return createElement(
    DensityContext.Provider,
    { value },
    createElement(ScreenProvider, {
      density: fitted,
      ...(screen === undefined ? {} : { source: screen }),
      ...(root === undefined ? {} : { root }),
      children,
    }),
  );
}

export function useDensity(): DensityValue {
  const value = useContext(DensityContext);
  if (value === null)
    throw new RexError("REX306", "rex: useDensity must be called inside DensityProvider");
  return value;
}
