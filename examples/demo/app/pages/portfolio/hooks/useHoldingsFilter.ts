import { useDraft } from "@sidioralabs/rex/client";
import { z } from "@sidioralabs/rex";

const holdingsFilter = z.object({ query: z.string().check(z.maxLength(40)) });

export function useHoldingsFilter() {
  const draft = useDraft(holdingsFilter);
  const query = draft.value?.query ?? "";
  return {
    query,
    setQuery: (next: string) => draft.set(next.trim() === "" ? null : { query: next }),
  };
}
