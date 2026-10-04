import type { ActControlProps, OverlayHandle } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";

export interface TokenFieldProps {
  readonly token: {
    readonly symbol: string;
    readonly name: string;
    readonly balance: string;
  } | null;
  readonly control: ActControlProps;
  readonly sheetTrigger: OverlayHandle["triggerProps"];
  readonly onNext: () => void;
}

export default function TokenField({ token, control, sheetTrigger, onNext }: TokenFieldProps) {
  return (
    <Card title="Token">
      <p data-demo-selected-token={token === null ? "" : token.symbol}>
        {token === null
          ? "No token selected"
          : `${token.symbol} (${token.name}), balance ${token.balance}`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--rex-space-2)" }}>
        <Button {...sheetTrigger}>Choose token</Button>
        <Button {...control} onClick={onNext}>
          Next token
        </Button>
      </div>
    </Card>
  );
}
