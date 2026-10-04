import BalanceRegion from "./regions/balance/region.tsx";

export default function WalletView() {
  return (
    <main style={{ width: 960 }}>
      <BalanceRegion />
    </main>
  );
}
