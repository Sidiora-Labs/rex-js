import Button from "../../../../../components/Button.tsx";
import type { Token } from "../../../../../entities/token.ts";
import TokenChip from "./TokenChip.tsx";

interface AmountFieldProps {
  readonly tokens: readonly Token[];
}

export default function AmountField({ tokens }: AmountFieldProps) {
  return (
    <fieldset>
      <input name="amount" inputMode="decimal" />
      {tokens.map((entry) => (
        <TokenChip key={entry.id} symbol={entry.symbol} />
      ))}
      <Button>Max</Button>
    </fieldset>
  );
}
