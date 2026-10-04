import {
  Component,
  createContext,
  useCallback,
  useContext,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { regionAddress } from "../core/ids.ts";
import { STATE_EXPORT_NAMES, type StateProps } from "../core/states.ts";
import { useRegionFailureRegistry } from "./agent/sidecar.tsx";
import { useOutcomeStore } from "./outcome.ts";
import { DefaultState, usePageRuntime, type PageParamsValue } from "./page.tsx";

export const REGION_ERROR_CODE = "REX330";

export const PageStatesContext = createContext<Readonly<Record<string, unknown>> | null>(null);
PageStatesContext.displayName = "RexPageStates";

export function regionFailureMessage(address: string, error: Error): string {
  return `${REGION_ERROR_CODE} region ${address} failed: ${error.message}`;
}

interface BoundaryFallbackProps {
  readonly address: string;
  readonly error: Error;
  readonly retry: () => void;
}

interface BoundaryProps {
  readonly address: string;
  readonly fallback: (props: BoundaryFallbackProps) => ReactNode;
  readonly onError: (error: Error) => void;
  readonly onRetry: () => void;
  readonly children?: ReactNode;
}

interface BoundaryState {
  readonly error: Error | null;
}

class RegionErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error instanceof Error ? error : new Error(String(error)));
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return this.props.fallback({
      address: this.props.address,
      error,
      retry: this.props.onRetry,
    });
  }
}

type StateExport = (props: StateProps<PageParamsValue>) => ReactNode;

export interface RegionBoundaryProps {
  readonly region: string;
  readonly children?: ReactNode;
}

export function RegionBoundary({ region, children }: RegionBoundaryProps) {
  const runtime = usePageRuntime();
  const states = useContext(PageStatesContext);
  const failures = useRegionFailureRegistry();
  const outcomes = useOutcomeStore();
  const [attempt, setAttempt] = useState(0);
  const pageId = runtime.page.id;
  const address = regionAddress(pageId, region);

  const onError = useCallback(
    (error: Error) => {
      const message = regionFailureMessage(address, error);
      failures.fail(pageId, { region, code: REGION_ERROR_CODE, message });
      outcomes.set(pageId, {
        actionId: address,
        ok: false,
        message,
        at: new Date().toISOString(),
      });
    },
    [address, failures, outcomes, pageId, region],
  );

  const onRetry = useCallback(() => {
    failures.clear(pageId, region);
    setAttempt((count) => count + 1);
  }, [failures, pageId, region]);

  const fallback = ({ error, retry }: BoundaryFallbackProps) => {
    const declared = runtime.page.states.includes("recoverable-error");
    const Export = declared
      ? (states?.[STATE_EXPORT_NAMES["recoverable-error"]] as StateExport | undefined)
      : undefined;
    return (
      <div data-rex-region-error={address} data-rex-error-code={REGION_ERROR_CODE}>
        {Export === undefined ? (
          <DefaultState
            state="recoverable-error"
            params={runtime.params}
            retry={retry}
            error={error}
          />
        ) : (
          <Export params={runtime.params} retry={retry} error={error} />
        )}
      </div>
    );
  };

  return (
    <RegionErrorBoundary
      key={attempt}
      address={address}
      fallback={fallback}
      onError={onError}
      onRetry={onRetry}
    >
      {children}
    </RegionErrorBoundary>
  );
}
