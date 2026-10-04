export function Loading() {
  return <p>Loading notes</p>;
}

export function Empty() {
  return <p>No notes yet</p>;
}

export function Stale() {
  return <p>Notes may be out of date</p>;
}

export function Partial() {
  return <p>Some notes could not be loaded</p>;
}

export function Offline() {
  return <p>You are offline</p>;
}

export function PermissionDenied() {
  return <p>You cannot view notes</p>;
}

export function RecoverableError() {
  return <p>Notes failed to load</p>;
}

export function TerminalError() {
  return <p>Notes are unavailable</p>;
}
