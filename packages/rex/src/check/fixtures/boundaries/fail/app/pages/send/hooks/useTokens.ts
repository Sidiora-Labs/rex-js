import { useQuery } from "@tanstack/react-query";
import Button from "../../../components/Button.tsx";
import { tokenStore } from "../../../data/tokens.ts";

export function useTokens() {
  const query = useQuery({
    queryKey: ["tokens", typeof Button],
    queryFn: async () => (await tokenStore.list()).items,
  });
  return query.data ?? [];
}
