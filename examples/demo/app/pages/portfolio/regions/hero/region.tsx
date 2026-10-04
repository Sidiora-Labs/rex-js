import { region } from "@sidioralabs/rex/client";
import { useWallet } from "../../hooks/useWallet.ts";
import BalanceHero from "./parts/BalanceHero.tsx";

export default region("hero", () => {
  const wallet = useWallet();
  const data = wallet.data;
  if (data === undefined) return null;
  return (
    <BalanceHero
      name={data.account.name}
      address={data.account.address}
      totalUsd={data.totalUsd}
      tokenCount={data.tokens.length}
      change24hUsd={data.change24hUsd}
      change24hPct={data.change24hPct}
    />
  );
});
