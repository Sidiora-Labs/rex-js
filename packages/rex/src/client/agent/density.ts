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
import { REX_DENSITY_HEADER } from "../../core/protocol.ts";
import { DEFAULT_DENSITY, isRexDensity, type RexDensity } from "../../server/context.ts";
import { RexRuntimeContext } from "../context.ts";

export type { RexDensity };

export const DENSITY_QUERY_KEY = "density";
export const DENSITY_STORAGE_KEY = "rex:density";
export const DENSITY_ATTRIBUTE = "data-rex-density";
export const DENSITY_HEADER = REX_DENSITY_HEADER;

export type DensitySource = "query" | "header" | "stored" | "default" | "set";

export interface DensityInputs {
  readonly query?: string | null;
  readonly header?: string | null;
  readonly stored?: string | null;
  readonly fallback?: RexDensity;
}

export interface ResolvedDensity {
  readonly density: RexDensity;
  readonly source: DensitySource;
}

export function densityFromSearch(search: string): string | null {
  return new URLSearchParams(search).get(DENSITY_QUERY_KEY);
}

export function resolveDensity(inputs: DensityInputs): ResolvedDensity {
  if (isRexDensity(inputs.query)) return { density: inputs.query, source: "query" };
  if (isRexDensity(inputs.header)) return { density: inputs.header, source: "header" };
  if (isRexDensity(inputs.stored)) return { density: inputs.stored, source: "stored" };
  return { density: inputs.fallback ?? DEFAULT_DENSITY, source: "default" };
}

export function readStoredDensity(): string | null {
  try {
    return globalThis.localStorage?.getItem(DENSITY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredDensity(density: RexDensity): void {
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
  setDensity(density: RexDensity): void;
}

export const DensityContext = createContext<DensityValue | null>(null);
DensityContext.displayName = "RexDensity";

export interface DensityProviderProps {
  readonly children?: ReactNode;
  readonly search?: string;
  readonly header?: string | null;
  readonly root?: HTMLElement;
}

export function DensityProvider({ children, search, header, root }: DensityProviderProps) {
  const runtime = useContext(RexRuntimeContext);
  const query = densityFromSearch(search ?? globalThis.location?.search ?? "");
  const headerValue = header !== undefined ? header : (runtime?.density ?? null);
  const [chosen, setChosen] = useState<RexDensity | null>(null);
  const [stored] = useState(readStoredDensity);

  const resolved = useMemo<ResolvedDensity>(
    () =>
      chosen !== null
        ? { density: chosen, source: "set" }
        : resolveDensity({ query, header: headerValue, stored }),
    [chosen, query, headerValue, stored],
  );

  const setDensity = useCallback((density: RexDensity) => {
    if (!isRexDensity(density)) {
      throw new TypeError(`rex: density must be "default" or "agent", received ${String(density)}`);
    }
    writeStoredDensity(density);
    setChosen(density);
  }, []);

  useLayoutEffect(() => {
    const element = root ?? globalThis.document?.documentElement;
    if (element === undefined) return;
    const previous = element.getAttribute(DENSITY_ATTRIBUTE);
    element.setAttribute(DENSITY_ATTRIBUTE, resolved.density);
    return () => {
      if (previous === null) element.removeAttribute(DENSITY_ATTRIBUTE);
      else element.setAttribute(DENSITY_ATTRIBUTE, previous);
    };
  }, [resolved.density, root]);

  useLayoutEffect(() => {
    const element = root ?? globalThis.document?.documentElement;
    if (element === undefined || resolved.density !== "agent") return;
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
  }, [resolved.density, root]);

  const value = useMemo<DensityValue>(() => ({ ...resolved, setDensity }), [resolved, setDensity]);
  return createElement(DensityContext.Provider, { value }, children);
}

export function useDensity(): DensityValue {
  const value = useContext(DensityContext);
  if (value === null) throw new Error("rex: useDensity must be called inside DensityProvider");
  return value;
}
