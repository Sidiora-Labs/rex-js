import type { ReactNode } from "react";
import Card from "../../../../../components/Card.tsx";
import HoldingsTable, { type Holding } from "../../../../../components/HoldingsTable.tsx";

export interface HoldingsListProps {
  readonly holdings: readonly Holding[];
  readonly filter: string;
  readonly onFilter: (query: string) => void;
  readonly toolbar?: ReactNode;
}

export default function HoldingsList({ holdings, filter, onFilter, toolbar }: HoldingsListProps) {
  return (
    <Card
      title="Holdings"
      description={
        filter === "" ? (
          `${holdings.length} ${holdings.length === 1 ? "token" : "tokens"}`
        ) : holdings.length === 0 ? (
          <span role="status">{`No holding matches "${filter}"`}</span>
        ) : (
          `${holdings.length} matching "${filter}"`
        )
      }
      action={toolbar}
    >
      <HoldingsTable holdings={holdings} search={filter} onSearch={onFilter} />
    </Card>
  );
}
