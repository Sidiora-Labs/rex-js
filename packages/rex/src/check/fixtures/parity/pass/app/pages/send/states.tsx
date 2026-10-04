import type { StateProps } from "@sidioralabs/rex";

export function Loading(_props: StateProps) {
  return <p role="status">Loading</p>;
}

export function Empty(_props: StateProps) {
  return <p>Nothing to send</p>;
}

export function Stale(_props: StateProps) {
  return <p>Refreshing balances</p>;
}

export function Partial(_props: StateProps) {
  return <p>Some balances are missing</p>;
}

export function Offline({ retry }: StateProps) {
  return (
    <button type="button" onClick={retry}>
      Retry
    </button>
  );
}

export function PermissionDenied(_props: StateProps) {
  return <p>Unlock the wallet to send</p>;
}

export function RecoverableError({ retry }: StateProps) {
  return (
    <button type="button" onClick={retry}>
      Try again
    </button>
  );
}

export function TerminalError(_props: StateProps) {
  return <p>Sending is unavailable</p>;
}
