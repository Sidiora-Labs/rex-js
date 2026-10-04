import type { OverlayHandle } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--rex-space-2)" }}>
      {sendPage === null ? null : (
        <Button tone="primary" data-rex-nav={sendPage} onClick={onSend}>
          Send tokens
        </Button>
      )}
      <Button {...sheetTrigger}>Filter holdings</Button>
      <p style={{ margin: 0 }}>{filter === "" ? "No filter applied" : `Filtered by "${filter}"`}</p>
    </div>
  );
}
