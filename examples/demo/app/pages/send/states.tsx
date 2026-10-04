import type { StateProps } from "@sidioralabs/rex";

export function Loading() {
  return <p role="status">Loading send</p>;
}

export function Empty() {
  return <p>Nothing in send yet</p>;
}

export function Stale({ retry }: StateProps) {
  return (
    <section role="status">
      <p>Send may be out of date</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function Partial({ retry }: StateProps) {
  return (
    <section role="status">
      <p>Part of send could not be loaded</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function Offline({ retry }: StateProps) {
  return (
    <section role="status">
      <p>You are offline; send will refresh when the connection returns</p>
      <button type="button" onClick={retry}>
        Refresh
      </button>
    </section>
  );
}

export function PermissionDenied() {
  return <p role="alert">You do not have access to send</p>;
}

export function RecoverableError({ error, retry }: StateProps) {
  return (
    <section role="alert">
      <p>Send failed to load</p>
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
      <p>Send is unavailable</p>
      {error === null ? null : <p>{error.message}</p>}
    </section>
  );
}
