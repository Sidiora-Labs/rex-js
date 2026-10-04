import { useId } from "react";
import Button from "../../../../../components/Button.tsx";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../../../../../components/ui/number-field.tsx";

export interface AmountFieldProps {
  readonly amount: string;
  readonly valid: boolean;
  readonly symbol: string;
  readonly balance: string;
  readonly priceUsd: string;
  readonly onAmount: (amount: string) => void;
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const DEFAULT_AMOUNT = "0.001";

export default function AmountField({
  amount,
  valid,
  symbol,
  balance,
  priceUsd,
  onAmount,
}: AmountFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const effective = amount === "" ? DEFAULT_AMOUNT : amount;
  const fiat = valid ? USD.format(Number(effective) * Number(priceUsd)) : null;
  return (
    <div className="flex flex-col gap-2" data-invalid={valid ? undefined : ""}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {symbol === "" ? "Amount" : `Amount in ${symbol}`}
      </label>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-container p-3">
        <NumberField
          id={inputId}
          name="amount"
          min={0}
          step={0.001}
          format={{ maximumFractionDigits: 6, useGrouping: false }}
          value={amount === "" || !valid ? null : Number(amount)}
          onValueChange={(value) => onAmount(value === null ? "" : String(value))}
        >
          <NumberFieldGroup className="h-12 bg-background">
            <NumberFieldDecrement aria-label="Decrease amount" />
            <NumberFieldInput
              placeholder={DEFAULT_AMOUNT}
              aria-describedby={hintId}
              aria-invalid={!valid}
              className="w-32 text-base"
            />
            <NumberFieldIncrement aria-label="Increase amount" />
          </NumberFieldGroup>
        </NumberField>
        <Button size="sm" onClick={() => onAmount(balance)}>
          Max
        </Button>
        <span className="ml-auto text-right text-sm">
          <span className="block text-muted-foreground">Fiat value</span>
          <span className="font-medium tabular-nums" data-demo-fiat="">
            {fiat ?? "Not available"}
          </span>
        </span>
      </div>
      <small
        id={hintId}
        role={valid ? undefined : "alert"}
        className={valid ? "text-muted-foreground" : "text-destructive"}
      >
        {valid
          ? `Available ${balance} ${symbol}. Leave empty to send the default ${DEFAULT_AMOUNT}.`
          : "Enter a decimal amount such as 0.5"}
      </small>
    </div>
  );
}
