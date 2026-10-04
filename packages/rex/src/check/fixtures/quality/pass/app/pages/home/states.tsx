import type { StateProps } from "@sidioralabs/rex";

export function Loading(_props: StateProps) {
  return <p className="animate-pulse">Loading holdings</p>;
}

export function Empty(_props: StateProps) {
  return <p>No holdings yet</p>;
}

export function Stale(_props: StateProps) {
  return <p>Refreshing holdings</p>;
}

export function Partial(_props: StateProps) {
  return <p>Some holdings could not be loaded</p>;
}

export function Offline({ retry }: StateProps) {
  return (
    <button type="button" className="control" onClick={retry}>
      Retry
    </button>
  );
}

export function PermissionDenied(_props: StateProps) {
  return <p>Unlock the wallet to view holdings</p>;
}

export function RecoverableError({ retry }: StateProps) {
  return (
    <button type="button" className="control" onClick={retry}>
      Try again
    </button>
  );
}

export function TerminalError(_props: StateProps) {
  return <p>Holdings are unavailable</p>;
}
