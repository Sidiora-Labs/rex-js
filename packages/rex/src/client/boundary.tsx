import {
  Component,
  useCallback,
  useContext,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { regionAddress } from "../core/ids.ts";
import { STATE_EXPORT_NAMES, type StateProps } from "../core/states.ts";
import { useRegionFailureRegistry } from "./agent/sidecar.tsx";
import { useOutcomeStore } from "./outcome.ts";
import { useFallback } from "./fallback-host.ts";
import { DefaultState, PageStatesContext, usePageRuntime, type PageParamsValue } from "./page.tsx";

export const REGION_ERROR_CODE = "REX330";

export function regionFailureMessage(address: string, error: Error): string {
  return `${REGION_ERROR_CODE} region ${address} failed: ${error.message}`;
}

interface BoundaryFallbackProps {
  readonly address: string;
  readonly error: Error;
  readonly retry: () => void;
}

type StateExport = ComponentType<StateProps<PageParamsValue>>;

function LazyRegionError({ address, error, retry }: BoundaryFallbackProps) {
  const runtime = usePageRuntime();
  const states = useContext(PageStatesContext);
  const Fallback = useFallback("RegionErrorFallback", runtime.page.id);
  if (Fallback === null) return null;
  const declared = runtime.page.states.includes("recoverable-error");
  const Export = declared
    ? (states?.[STATE_EXPORT_NAMES["recoverable-error"]] as StateExport | undefined)
    : undefined;
  return (
    <Fallback
      address={address}
      code={REGION_ERROR_CODE}
      error={error}
      retry={retry}
      params={runtime.params}
      Export={Export}
      Default={DefaultState}
    />
  );
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

export interface RegionBoundaryProps {
  readonly region: string;
  readonly children?: ReactNode;
}

export function RegionBoundary({ region, children }: RegionBoundaryProps) {
  const runtime = usePageRuntime();
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

  const fallback = ({ error, retry }: BoundaryFallbackProps) => (
    <LazyRegionError address={address} error={error} retry={retry} />
  );

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
