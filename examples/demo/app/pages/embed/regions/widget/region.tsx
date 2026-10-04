import { region, useT } from "@sidioralabs/rex/client";
import { useEffect } from "react";
import { defineTokenChip } from "../../../../components/token-chip-element.ts";
import { useTokens } from "../../hooks/useTokens.ts";
import { useWatchlist } from "../../hooks/useWatchlist.ts";
import WatchedChips from "./parts/WatchedChips.tsx";

export default region("widget", () => {
  const t = useT();
  const prices = useTokens();
  const { watched } = useWatchlist();
  useEffect(defineTokenChip, []);
  const data = prices.data;
  if (data === undefined) return null;
  return (
    <WatchedChips
      heading={t("embed.heading")}
      chips={data.tokens.filter((entry) => watched.includes(entry.id))}
    />
  );
});
