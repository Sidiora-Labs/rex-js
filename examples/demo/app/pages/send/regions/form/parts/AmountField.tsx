import Field from "../../../../../components/Field.tsx";

export interface AmountFieldProps {
  readonly amount: string;
  readonly valid: boolean;
  readonly symbol: string;
  readonly balance: string;
  readonly onAmount: (amount: string) => void;
}

export default function AmountField({
  amount,
  valid,
  symbol,
  balance,
  onAmount,
}: AmountFieldProps) {
  return (
    <Field
      label={symbol === "" ? "Amount" : `Amount in ${symbol}`}
      name="amount"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0.001"
      value={amount}
      hint={`Available ${balance} ${symbol}. Leave empty to send the default 0.001.`}
      error={valid ? null : "Enter a decimal amount such as 0.5"}
      onChange={(event) => onAmount(event.target.value)}
    />
  );
}
