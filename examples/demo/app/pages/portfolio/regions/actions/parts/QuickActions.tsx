import type { OverlayHandle } from "@sidioralabs/rex/client";
import { ArrowDownLeftIcon, ListFilterIcon, SendIcon } from "../../../../../components/icons.ts";
import Button from "../../../../../components/Button.tsx";
import { Badge } from "../../../../../components/ui/badge.tsx";

export interface QuickActionsProps {
  readonly filter: string;
  readonly sheetTrigger: OverlayHandle["triggerProps"];
  readonly sendPage: string | null;
  readonly onSend: () => void;
}

export default function QuickActions({
  filter,
  sheetTrigger,
  sendPage,
  onSend,
}: QuickActionsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Wallet actions"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-container p-2"
    >
      {sendPage === null ? null : (
        <Button tone="primary" data-rex-nav={sendPage} onClick={onSend}>
          <SendIcon aria-hidden="true" />
          Send tokens
        </Button>
      )}
      <Button tone="quiet" render={<a href="#wallet-address" aria-label="Receive" />}>
        <ArrowDownLeftIcon aria-hidden="true" />
        Receive
      </Button>
      <Button {...sheetTrigger}>
        <ListFilterIcon aria-hidden="true" />
        Filter holdings
      </Button>
      <p className="m-0 ml-auto px-2 text-sm text-muted-foreground">
        {filter === "" ? (
          "No filter applied"
        ) : (
          <Badge variant="tonal">{`Filtered by "${filter}"`}</Badge>
        )}
      </p>
    </div>
  );
}
