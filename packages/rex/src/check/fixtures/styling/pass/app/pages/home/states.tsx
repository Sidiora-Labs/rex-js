import type { StateProps } from "@sidioralabs/rex";

export function Loading(_props: StateProps) {
  return <p role="status">Loading home</p>;
}

export function Empty(_props: StateProps) {
  return <p>Nothing here yet</p>;
}

export function Stale(_props: StateProps) {
  return <p>Showing saved data while refreshing</p>;
}

export function Partial(_props: StateProps) {
  return <p>Some data could not be loaded</p>;
}

export function Offline({ retry }: StateProps) {
  return (
    <section>
      <p>You are offline</p>
      <button type="button" onClick={retry}>
        Retry
      </button>
    </section>
  );
}

export function PermissionDenied(_props: StateProps) {
  return <p>You do not have access to this page</p>;
}

export function RecoverableError({ retry, error }: StateProps) {
  return (
    <section>
      <p>Something went wrong: {error?.message ?? "unknown error"}</p>
      <button type="button" onClick={retry}>
        Retry
      </button>
    </section>
  );
}

export function TerminalError({ error }: StateProps) {
  return <p>This page cannot be shown: {error?.message ?? "unknown error"}</p>;
}
