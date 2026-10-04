import type { StateProps } from "@sidioralabs/rex";

export function Loading() {
  return <p role="status">Loading portfolio</p>;
}

export function Empty() {
  return <p>Nothing in portfolio yet</p>;
}

export function Stale({ retry }: StateProps) {
  return (
    <section role="status">
      <p>Portfolio may be out of date</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function Partial({ retry }: StateProps) {
  return (
    <section role="status">
      <p>Part of portfolio could not be loaded</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function Offline({ retry }: StateProps) {
  return (
    <section role="status">
      <p>You are offline; portfolio will refresh when the connection returns</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function PermissionDenied() {
  return <p role="alert">You do not have access to portfolio</p>;
}

export function RecoverableError({ error, retry }: StateProps) {
  return (
    <section role="alert">
      <p>Portfolio failed to load</p>
      {error === null ? null : <p>{error.message}</p>}
      <button type="button" onClick={retry}>
        Try again
      </button>
    </section>
  );
}

export function TerminalError({ error }: StateProps) {
  return (
    <section role="alert">
      <p>Portfolio is unavailable</p>
      {error === null ? null : <p>{error.message}</p>}
    </section>
  );
}
