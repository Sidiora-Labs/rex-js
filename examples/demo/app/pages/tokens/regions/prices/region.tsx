import { region } from "@sidioralabs/rex/client";
import { useT } from "@sidioralabs/rex/client/i18n";
import { useTokenPrices } from "../../hooks/useTokenPrices.ts";
import { useWatchlist } from "../../hooks/useWatchlist.ts";
import PriceTable from "./parts/PriceTable.tsx";

export default region("prices", () => {
  const t = useT();
  const prices = useTokenPrices();
  const { watched, toggle } = useWatchlist();
  return (
    <PriceTable
      heading={t("tokens.heading")}
      summary={t("tokens.watching", { count: watched.length })}
      watchLabel={t("tokens.watch")}
      tokens={prices.map((entry) => ({ ...entry, watched: watched.includes(entry.id) }))}
      onToggle={toggle}
    />
  );
});
