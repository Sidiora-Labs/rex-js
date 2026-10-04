import Button from "../../../components/Button.tsx";
import type { Token } from "../../../entities/token.ts";
import TokenChip from "../regions/form/parts/TokenChip.tsx";

interface TokenSheetProps {
  readonly tokens: readonly Token[];
}

export default function TokenSheet({ tokens }: TokenSheetProps) {
  return (
    <dialog>
      {tokens.map((entry) => (
        <TokenChip key={entry.id} symbol={entry.symbol} />
      ))}
      <Button>Close</Button>
    </dialog>
  );
}
