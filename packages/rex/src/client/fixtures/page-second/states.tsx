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
  return <Message text="Loading second page" />;
}

export function Empty() {
  return <Message text="Second page is empty" />;
}

export function Stale({ retry }: Props) {
  return <Message text="Second page may be out of date" retry={retry} />;
}

export function Partial() {
  return <Message text="Second page is incomplete" />;
}

export function Offline({ retry }: Props) {
  return <Message text="Second page is offline" retry={retry} />;
}

export function PermissionDenied() {
  return <Message text="You cannot open the second page" />;
}

export function RecoverableError({ retry }: Props) {
  return <Message text="Second page failed" retry={retry} />;
}

export function TerminalError({ error }: Props) {
  return <Message text={`Second page unavailable: ${error?.message ?? "unknown"}`} />;
}
