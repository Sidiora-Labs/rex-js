import type { ActControlProps, OverlayHandle } from "@sidioralabs/rex/client";
import { ChevronsUpDownIcon, RefreshCwIcon } from "../../../../../components/icons.ts";
import Button from "../../../../../components/Button.tsx";
import { Avatar, AvatarFallback } from "../../../../../components/ui/avatar.tsx";

export interface ContactFieldProps {
  readonly contact: { readonly name: string; readonly address: string } | null;
  readonly control: ActControlProps;
  readonly sheetTrigger: OverlayHandle["triggerProps"];
  readonly onNext: () => void;
}

export default function ContactField({
  contact,
  control,
  sheetTrigger,
  onNext,
}: ContactFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Recipient</span>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-container p-3">
        {contact === null ? null : (
          <Avatar aria-hidden="true">
            <AvatarFallback className="bg-(--dx-pink-1) font-semibold text-(--dx-pink-5)">
              {contact.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        )}
        <p
          className="m-0 flex min-w-0 flex-1 flex-col"
          data-demo-selected-contact={contact === null ? "" : contact.name}
        >
          {contact === null ? (
            <span className="text-muted-foreground">No recipient selected</span>
          ) : (
            <>
              <span className="font-medium">{contact.name}</span>
              <code className="truncate font-mono text-xs text-muted-foreground">
                {contact.address}
              </code>
            </>
          )}
        </p>
        <span className="flex flex-wrap gap-2">
          <Button {...sheetTrigger}>
            <ChevronsUpDownIcon aria-hidden="true" />
            Choose recipient
          </Button>
          <Button tone="ghost" {...control} onClick={onNext}>
            <RefreshCwIcon aria-hidden="true" />
            Next recipient
          </Button>
        </span>
      </div>
    </div>
  );
}
