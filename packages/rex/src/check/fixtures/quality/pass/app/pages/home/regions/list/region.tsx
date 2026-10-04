import { useHoldings } from "../../hooks/useHoldings.ts";
import FilterSheet from "../../overlays/FilterSheet.tsx";
import HoldingRow from "./parts/HoldingRow.tsx";
import Spinner from "./parts/Spinner.tsx";

export default function ListRegion() {
  const holdings = useHoldings();
  return (
    <section className="stack gap-4 text-fg bg-surface">
      <Spinner />
      <ul className={`list ${holdings.length > 0 ? "list-filled" : "list-empty"}`}>
        {holdings.map((symbol) => (
          <HoldingRow key={symbol} symbol={symbol} />
        ))}
      </ul>
      <FilterSheet />
    </section>
  );
}
