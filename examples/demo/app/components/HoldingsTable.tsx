import { useScreen } from "@sidioralabs/rex/client";
import type { ColumnDef } from "@tanstack/react-table";
import ChangeBadge from "./ChangeBadge.tsx";
import TokenAvatar from "./TokenAvatar.tsx";
import { Badge } from "./ui/badge.tsx";
import { Card, CardContent } from "./ui/card.tsx";
import { DataTable, DataTableColumnHeader } from "./ui/data-table.tsx";
import { Input } from "./ui/input.tsx";

export interface Holding {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly balance: string;
  readonly valueUsd: string;
  readonly dust: boolean;
  readonly change24hPct: string;
}

export interface HoldingsTableProps {
  readonly holdings: readonly Holding[];
  readonly search: string;
  readonly onSearch: (query: string) => void;
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const COLUMNS: ColumnDef<Holding>[] = [
  {
    accessorKey: "symbol",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Token" />,
    cell: ({ row }) => (
      <span className="flex items-center gap-3" data-demo-holding={row.original.id}>
        <TokenAvatar symbol={row.original.symbol} />
        <span className="font-medium">{row.original.symbol}</span>
        {row.original.dust ? <Badge variant="tonal">dust</Badge> : null}
      </span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.name}</span>,
  },
  {
    id: "balance",
    accessorFn: (holding) => Number(holding.balance),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
    cell: ({ row }) => (
      <span className="font-mono text-[13px] tabular-nums">
        {`${row.original.balance} ${row.original.symbol}`}
      </span>
    ),
  },
  {
    id: "value",
    accessorFn: (holding) => Number(holding.valueUsd),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{USD.format(Number(row.original.valueUsd))}</span>
    ),
  },
  {
    id: "change",
    accessorFn: (holding) => Number(holding.change24hPct),
    header: ({ column }) => <DataTableColumnHeader column={column} title="24h" />,
    cell: ({ row }) => <ChangeBadge pct={row.original.change24hPct} />,
  },
];

function SearchInput({ search, onSearch }: Omit<HoldingsTableProps, "holdings">) {
  return (
    <Input
      type="search"
      aria-label="Search holdings"
      placeholder="Search holdings"
      name="holdings-search"
      autoComplete="off"
      value={search}
      className="h-9 max-w-64 rounded-full"
      onChange={(event) => onSearch(event.target.value)}
    />
  );
}

function HoldingCard({ holding }: { readonly holding: Holding }) {
  return (
    <li>
      <Card variant="tonal" className="gap-3 py-4">
        <CardContent className="flex flex-col gap-3 px-4">
          <span className="flex items-center gap-3" data-demo-holding={holding.id}>
            <TokenAvatar symbol={holding.symbol} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{holding.symbol}</span>
              <span className="truncate text-sm text-muted-foreground">{holding.name}</span>
            </span>
            {holding.dust ? <Badge variant="tonal">dust</Badge> : null}
            <ChangeBadge pct={holding.change24hPct} />
          </span>
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Balance</dt>
            <dd className="m-0 truncate text-right font-mono text-[13px] tabular-nums">
              {`${holding.balance} ${holding.symbol}`}
            </dd>
            <dt className="text-muted-foreground">Value</dt>
            <dd className="m-0 truncate text-right font-medium tabular-nums">
              {USD.format(Number(holding.valueUsd))}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </li>
  );
}

function HoldingsCards({ holdings, search, onSearch }: HoldingsTableProps) {
  return (
    <div data-slot="card-list" className="flex w-full flex-col gap-3">
      <SearchInput search={search} onSearch={onSearch} />
      {holdings.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm text-muted-foreground">No results.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {holdings.map((holding) => (
            <HoldingCard key={holding.id} holding={holding} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function HoldingsTable({ holdings, search, onSearch }: HoldingsTableProps) {
  const { screen } = useScreen();
  if (screen === "phone") {
    return <HoldingsCards holdings={holdings} search={search} onSearch={onSearch} />;
  }
  return (
    <DataTable
      columns={COLUMNS}
      data={[...holdings]}
      pageSize={10}
      toolbar={<SearchInput search={search} onSearch={onSearch} />}
    />
  );
}
