import type { StateProps } from "@sidioralabs/rex";

export function Loading(_props: StateProps) {
  return <p role="status">Loading portfolio</p>;
}

export function Empty(_props: StateProps) {
  return <p>No holdings yet</p>;
}
