import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";

export interface PricedToken {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly priceUsd: string;
  readonly watched: boolean;
}

export interface PriceTableProps {
  readonly heading: string;
  readonly summary: string;
  readonly watchLabel: string;
  readonly tokens: readonly PricedToken[];
  readonly onToggle: (tokenId: string) => void;
}

export default function PriceTable({
  heading,
  summary,
  watchLabel,
  tokens,
  onToggle,
}: PriceTableProps) {
  return (
    <Card title={heading}>
      <p data-demo-watching="">{summary}</p>
      <ul className="flex flex-col gap-2">
        {tokens.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3">
            <span>
              <strong>{entry.symbol}</strong> {entry.name}{" "}
              <span className="font-mono">{`$${entry.priceUsd}`}</span>
            </span>
            <Button aria-pressed={entry.watched} onClick={() => onToggle(entry.id)}>
              {`${watchLabel} ${entry.symbol}`}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
