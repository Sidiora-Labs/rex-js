import { procedureOf, type RexClient } from "@sidioralabs/rex/client";
import { queryOptions } from "@tanstack/react-query";
import { loadWallet } from "../actions/load-wallet.ts";

export const WALLET_QUERY = "wallet";

export function walletQuery(client: RexClient) {
  return queryOptions({
    queryKey: [WALLET_QUERY],
    queryFn: async () => loadWallet.output.parse(await procedureOf(client, loadWallet.id)({})),
  });
}
