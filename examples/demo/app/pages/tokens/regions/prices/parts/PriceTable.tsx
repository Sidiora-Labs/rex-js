import { StarIcon } from "../../../../../components/icons.ts";
import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";
import TokenAvatar from "../../../../../components/TokenAvatar.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table.tsx";

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
    <Card title={heading} description={<span data-demo-watching="">{summary}</span>}>
      <div className="overflow-hidden rounded-lg border border-outline-variant">
        <Table>
          <TableHeader className="bg-container/60">
            <TableRow className="hover:bg-transparent">
              <TableHead>Token</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Watchlist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <TokenAvatar symbol={entry.symbol} />
                    <span className="font-medium">{entry.symbol}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.name}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{`$${entry.priceUsd}`}</TableCell>
                <TableCell className="text-right">
                  <Button
                    tone={entry.watched ? "primary" : "quiet"}
                    size="sm"
                    aria-pressed={entry.watched}
                    onClick={() => onToggle(entry.id)}
                  >
                    <StarIcon aria-hidden="true" />
                    {`${watchLabel} ${entry.symbol}`}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
