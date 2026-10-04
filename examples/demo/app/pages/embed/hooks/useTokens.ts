import type { ActionOutput } from "@sidioralabs/rex";
import { useActivePage, useLoader, type RexLoaderError } from "@sidioralabs/rex/client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { listTokens } from "../../../actions/list-tokens.ts";

type TokenPrices = ActionOutput<typeof listTokens>;

export function useTokens(): UseQueryResult<TokenPrices, RexLoaderError> {
  const active = useActivePage();
  if (active === null)
    throw new Error("useTokens reads the tokens loader of the active embed page");
  return useLoader(active.page, "tokens") as UseQueryResult<TokenPrices, RexLoaderError>;
}
