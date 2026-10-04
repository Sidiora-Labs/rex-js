import type { StateProps } from "../../../index.ts";

type Props = StateProps<Readonly<Record<string, unknown>>>;

function Message({ text, retry }: { readonly text: string; readonly retry?: () => void }) {
  return (
    <div role="status">
      <p>{text}</p>
      {retry === undefined ? null : (
        <button type="button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Loading() {
  return <Message text="Loading notes" />;
}

export function Empty() {
  return <Message text="No notes yet" />;
}

export function Stale({ retry }: Props) {
  return <Message text="Notes may be out of date" retry={retry} />;
}

export function Partial() {
  return <Message text="Some notes are unavailable" />;
}

export function Offline({ retry }: Props) {
  return <Message text="Notes are offline" retry={retry} />;
}

export function PermissionDenied() {
  return <Message text="You cannot read notes" />;
}

export function RecoverableError({ error, retry }: Props) {
  return <Message text={`Notes failed: ${error?.message ?? "unknown"}`} retry={retry} />;
}

export function TerminalError({ error }: Props) {
  return <Message text={`Notes unavailable: ${error?.message ?? "unknown"}`} />;
}
