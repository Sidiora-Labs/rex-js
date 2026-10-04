interface TokenChipProps {
  readonly symbol: string;
}

export default function TokenChip({ symbol }: TokenChipProps) {
  return <span>{symbol}</span>;
}
