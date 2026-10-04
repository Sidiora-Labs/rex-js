import { Page } from "@sidioralabs/rex/client";
import Card from "../../../../../components/Card.tsx";
import HoldingRow, { type Holding } from "./HoldingRow.tsx";

export interface HoldingsListProps {
  readonly holdings: readonly Holding[];
  readonly filter: string;
}

export default function HoldingsList({ holdings, filter }: HoldingsListProps) {
  return (
    <Card title="Holdings">
      <Page.List
        name="holdings"
        label="Holdings"
        items={holdings}
        itemKey={(holding) => holding.id}
        size={3}
        empty={<p>{filter === "" ? "No holdings to show" : `No holding matches "${filter}"`}</p>}
      >
        {(holding) => <HoldingRow holding={holding} />}
      </Page.List>
    </Card>
  );
}
