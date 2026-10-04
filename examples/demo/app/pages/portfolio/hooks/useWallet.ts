import type { ActionOutput } from "@sidioralabs/rex";
import { useActivePage, useLoader, type RexLoaderError } from "@sidioralabs/rex/client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { loadWallet } from "../../../actions/load-wallet.ts";

type WalletOverview = ActionOutput<typeof loadWallet>;

export function useWallet(): UseQueryResult<WalletOverview, RexLoaderError> {
  const active = useActivePage();
  if (active === null)
    throw new Error("useWallet reads the wallet loader of the active portfolio page");
  return useLoader(active.page, "wallet") as UseQueryResult<WalletOverview, RexLoaderError>;
}
