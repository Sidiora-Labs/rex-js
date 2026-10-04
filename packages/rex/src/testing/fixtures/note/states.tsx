import type { StateProps } from "../../../index.ts";

type Props = StateProps<Readonly<Record<string, unknown>>>;

export function Loading() {
  return <p role="status">Loading note</p>;
}

export function TerminalError({ error }: Props) {
  return <p role="alert">Note unavailable: {error?.message ?? "unknown"}</p>;
}
