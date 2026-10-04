import { region } from "@sidioralabs/rex/client";
import { toggleHideDust } from "../../../../actions/toggle-hide-dust.ts";
import { useHoldingsFilter } from "../../hooks/useHoldingsFilter.ts";
import { useWallet } from "../../hooks/useWallet.ts";
import DustToggle from "./parts/DustToggle.tsx";
import HoldingsList from "./parts/HoldingsList.tsx";

export default region("holdings", ({ act }) => {
  const wallet = useWallet();
  const filter = useHoldingsFilter();
  const toggle = act(toggleHideDust);
  const data = wallet.data;
  if (data === undefined) return null;
  const hideDust = data.account.hideDust;
  const needle = filter.query.trim().toLowerCase();
  const shown = data.tokens.filter((entry) => !(hideDust && entry.dust));
  const matching = shown.filter(
    (entry) =>
      needle === "" ||
      entry.symbol.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle),
  );
  return (
    <HoldingsList
      holdings={matching}
      filter={filter.query}
      onFilter={filter.setQuery}
      toolbar={
        <DustToggle
          hideDust={hideDust}
          hiddenCount={data.tokens.length - shown.length}
          control={toggle.controlProps}
          onToggle={() => {
            void toggle.run({});
          }}
        />
      }
    />
  );
});
