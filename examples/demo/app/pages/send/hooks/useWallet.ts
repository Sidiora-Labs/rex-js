import { useRexClient } from "@sidioralabs/rex/client";
import { useQuery } from "@tanstack/react-query";
import { walletQuery } from "../../../data/wallet-query.ts";

export function useWallet() {
  return useQuery(walletQuery(useRexClient()));
}
