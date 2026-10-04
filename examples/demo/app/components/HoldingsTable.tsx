import type { ColumnDef } from "@tanstack/react-table";
import ChangeBadge from "./ChangeBadge.tsx";
import TokenAvatar from "./TokenAvatar.tsx";
import { Badge } from "./ui/badge.tsx";
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

export default function HoldingsTable({ holdings, search, onSearch }: HoldingsTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      data={[...holdings]}
      pageSize={10}
      toolbar={
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
      }
    />
  );
}
