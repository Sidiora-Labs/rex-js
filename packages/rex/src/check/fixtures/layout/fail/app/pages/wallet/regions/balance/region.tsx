import Chart from "./parts/Chart.tsx";
import Total from "./parts/Total.tsx";

export default function BalanceRegion() {
  return (
    <section aria-label="Balance" style={{ width: 640 }}>
      <Total />
      <Chart />
      <button type="button" className="h-8 px-3">
        Refresh
      </button>
    </section>
  );
}
