import { useQuery } from "@tanstack/react-query";
import { tokenStore } from "../../../data/tokens.ts";
import type { Token } from "../../../entities/token.ts";

export function useTokens(): readonly Token[] {
  const query = useQuery({
    queryKey: ["tokens"],
    queryFn: async () => (await tokenStore.list()).items,
  });
  return query.data ?? [];
}
