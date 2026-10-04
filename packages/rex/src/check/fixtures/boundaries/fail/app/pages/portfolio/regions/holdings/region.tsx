import HoldingRow from "./parts/HoldingRow.tsx";
import { ledgerBalance } from "../../../../server/ledger.ts";

export default function HoldingsRegion() {
  return <HoldingRow symbol={typeof ledgerBalance} />;
}
