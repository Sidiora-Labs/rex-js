import type { StateProps } from "@sidioralabs/rex";
import Button from "../../components/Button.tsx";
import TokenChip from "./regions/form/parts/TokenChip.tsx";

export function Loading(_props: StateProps) {
  return <p role="status">Loading tokens</p>;
}

export function Empty(_props: StateProps) {
  return <p>No tokens to send</p>;
}

export function Stale(_props: StateProps) {
  return <TokenChip symbol="saved" />;
}

export function Partial(_props: StateProps) {
  return <p>Some balances are missing</p>;
}

export function Offline({ retry }: StateProps) {
  return <Button onClick={retry}>Retry</Button>;
}

export function PermissionDenied(_props: StateProps) {
  return <p>Unlock the wallet to send</p>;
}

export function RecoverableError({ retry }: StateProps) {
  return <Button onClick={retry}>Try again</Button>;
}

export function TerminalError(_props: StateProps) {
  return <p>Sending is unavailable</p>;
}
