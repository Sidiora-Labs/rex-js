export interface TokenChipProps {
  readonly symbol?: string;
  readonly price?: string;
}

export default function TokenChip({ symbol = "?", price = "0" }: TokenChipProps) {
  return (
    <span data-demo-chip={symbol} className="inline-flex items-center gap-2">
      <strong>{symbol}</strong>
      <span className="font-mono">{`$${price}`}</span>
    </span>
  );
}
