import Card from "../../../../../components/Card.tsx";
import HoldingRow, { type Holding } from "./HoldingRow.tsx";

export interface HoldingsListProps {
  readonly holdings: readonly Holding[];
  readonly filter: string;
}

export default function HoldingsList({ holdings, filter }: HoldingsListProps) {
  return (
    <Card title="Holdings">
      {holdings.length === 0 ? (
        <p>{filter === "" ? "No holdings to show" : `No holding matches "${filter}"`}</p>
      ) : (
        <ul>
          {holdings.map((holding) => (
            <HoldingRow key={holding.id} holding={holding} />
          ))}
        </ul>
      )}
    </Card>
  );
}
