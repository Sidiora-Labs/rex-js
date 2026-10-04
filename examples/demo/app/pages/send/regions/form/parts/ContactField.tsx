import type { ActControlProps, OverlayHandle } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";

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
    <Card title="Recipient">
      <p data-demo-selected-contact={contact === null ? "" : contact.name}>
        {contact === null ? "No recipient selected" : `${contact.name} (${contact.address})`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--rex-space-2)" }}>
        <Button {...sheetTrigger}>Choose recipient</Button>
        <Button {...control} onClick={onNext}>
          Next recipient
        </Button>
      </div>
    </Card>
  );
}
