export const REX_DATA_STATES = [
  "loading",
  "empty",
  "stale",
  "partial",
  "offline",
  "permission-denied",
  "recoverable-error",
  "terminal-error",
  "ready",
] as const;

export type RexDataState = (typeof REX_DATA_STATES)[number];

export type NonReadyState = Exclude<RexDataState, "ready">;

type PascalSegments<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Capitalize<Head>}${PascalSegments<Tail>}`
  : Capitalize<S>;

export type StateExportName<S extends RexDataState> = PascalSegments<S>;

export const STATE_EXPORT_NAMES: { readonly [S in RexDataState]: StateExportName<S> } =
  Object.freeze({
    loading: "Loading",
    empty: "Empty",
    stale: "Stale",
    partial: "Partial",
    offline: "Offline",
    "permission-denied": "PermissionDenied",
    "recoverable-error": "RecoverableError",
    "terminal-error": "TerminalError",
    ready: "Ready",
  });

export function isRexDataState(value: unknown): value is RexDataState {
  return typeof value === "string" && (REX_DATA_STATES as readonly string[]).includes(value);
}

export function stateExportName<S extends RexDataState>(state: S): StateExportName<S> {
  return STATE_EXPORT_NAMES[state];
}

export interface StateProps<P = Record<string, unknown>> {
  readonly params: P;
  readonly retry: () => void;
  readonly error: Error | null;
}

export type StateComponent<P = Record<string, unknown>> = (props: StateProps<P>) => unknown;

export type StatesModule<S extends RexDataState = RexDataState, P = Record<string, unknown>> = {
  readonly [K in Exclude<S, "ready"> as StateExportName<K>]: StateComponent<P>;
};

export function requiredStateExports(states: readonly RexDataState[]): readonly string[] {
  return states.filter((state) => state !== "ready").map((state) => STATE_EXPORT_NAMES[state]);
}
