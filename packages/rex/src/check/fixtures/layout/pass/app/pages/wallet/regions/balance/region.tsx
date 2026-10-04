import Chart from "./parts/Chart.tsx";
import Total from "./parts/Total.tsx";

export default function BalanceRegion() {
  return (
    <section aria-label="Balance">
      <Total />
      <Chart />
      <button type="button" className="h-9 px-3 pointer-coarse:min-h-11">
        Refresh
      </button>
    </section>
  );
}
