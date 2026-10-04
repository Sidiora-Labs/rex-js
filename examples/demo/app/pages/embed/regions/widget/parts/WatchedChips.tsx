import Card from "../../../../../components/Card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface WatchedChip {
  readonly id: string;
  readonly symbol: string;
  readonly priceUsd: string;
}

export interface WatchedChipsProps {
  readonly heading: string;
  readonly chips: readonly WatchedChip[];
}

export default function WatchedChips({ heading, chips }: WatchedChipsProps) {
  return (
    <Card title={heading}>
      <Typography variant="muted">
        Each chip below is the <code>TokenChip</code> component registered as the{" "}
        <code>&lt;demo-token-chip&gt;</code> custom element; the watchlist is a shared store, so
        watching a token on the tokens page adds its chip here.
      </Typography>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.id}>
            <demo-token-chip
              tabIndex={0}
              symbol={chip.symbol}
              price={chip.priceUsd}
              className="inline-flex h-11 min-w-32 items-center rounded-full border border-border bg-container px-4 font-mono text-sm"
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
