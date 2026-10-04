import type { StateProps } from "@sidioralabs/rex";
import Button from "../../components/Button.tsx";

export function Loading() {
  return <p role="status">Loading about</p>;
}

export function Empty() {
  return <p>Nothing in about yet</p>;
}

export function Stale({ retry }: StateProps) {
  return (
    <section role="status">
      <p>About may be out of date</p>
      <Button onClick={retry}>Refresh</Button>
    </section>
  );
}

export function Partial({ retry }: StateProps) {
  return (
    <section role="status">
      <p>Part of about could not be loaded</p>
      <Button onClick={retry}>Refresh</Button>
    </section>
  );
}

export function Offline({ retry }: StateProps) {
  return (
    <section role="status">
      <p>You are offline; about will refresh when the connection returns</p>
      <Button onClick={retry}>Refresh</Button>
    </section>
  );
}

export function PermissionDenied() {
  return <p role="alert">You do not have access to about</p>;
}

export function RecoverableError({ error, retry }: StateProps) {
  return (
    <section role="alert">
      <p>About failed to load</p>
      {error === null ? null : <p>{error.message}</p>}
      <Button onClick={retry}>Try again</Button>
    </section>
  );
}

export function TerminalError({ error }: StateProps) {
  return (
    <section role="alert">
      <p>About is unavailable</p>
      {error === null ? null : <p>{error.message}</p>}
    </section>
  );
}
