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

export function Loading({ params }: Props) {
  return <Message text={`Loading greeting for ${String(params.name)}`} />;
}

export function Empty() {
  return <Message text="No greeting yet" />;
}

export function Stale({ retry }: Props) {
  return <Message text="Greeting may be out of date" retry={retry} />;
}

export function Partial() {
  return <Message text="Badges are unavailable" />;
}

export function Offline({ retry }: Props) {
  return <Message text="Offline" retry={retry} />;
}

export function PermissionDenied() {
  return <Message text="You cannot view greetings" />;
}

export function RecoverableError({ error, retry }: Props) {
  return <Message text={`Greeting failed: ${error?.message ?? "unknown"}`} retry={retry} />;
}

export function TerminalError({ error }: Props) {
  return <Message text={`Greeting unavailable: ${error?.message ?? "unknown"}`} />;
}
