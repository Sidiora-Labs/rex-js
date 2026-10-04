import type { StateProps } from "@sidioralabs/rex";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  Empty as EmptyFrame,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../components/ui/empty.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

export function Loading() {
  return (
    <div role="status" aria-label="Loading about" className="flex flex-col gap-3">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function Empty() {
  return (
    <EmptyFrame>
      <EmptyHeader>
        <EmptyTitle>Nothing in about yet</EmptyTitle>
        <EmptyDescription>New entries appear here.</EmptyDescription>
      </EmptyHeader>
    </EmptyFrame>
  );
}

export function Stale({ retry }: StateProps) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3">
      <Badge variant="warning">Stale</Badge>
      <p className="m-0">About may be out of date</p>
      <Button variant="outline" onClick={retry}>
        Refresh
      </Button>
    </div>
  );
}

export function Partial({ retry }: StateProps) {
  return (
    <Alert variant="warning">
      <AlertTitle>Part of about could not be loaded</AlertTitle>
      <AlertDescription>
        <Button variant="outline" onClick={retry}>
          Refresh
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function Offline({ retry }: StateProps) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3">
      <Badge variant="info">Offline</Badge>
      <p className="m-0">About will refresh when the connection returns</p>
      <Button variant="outline" onClick={retry}>
        Refresh
      </Button>
    </div>
  );
}

export function PermissionDenied() {
  return (
    <Alert variant="destructive">
      <AlertTitle>You do not have access to about</AlertTitle>
    </Alert>
  );
}

export function RecoverableError({ error, retry }: StateProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>About failed to load</AlertTitle>
      <AlertDescription>
        {error === null ? null : <p>{error.message}</p>}
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function TerminalError({ error }: StateProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>About is unavailable</AlertTitle>
      {error === null ? null : <AlertDescription>{error.message}</AlertDescription>}
    </Alert>
  );
}
