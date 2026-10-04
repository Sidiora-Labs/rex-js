interface HoldingRowProps {
  readonly symbol: string;
}

export default function HoldingRow({ symbol }: HoldingRowProps) {
  return <li>{symbol}</li>;
}
