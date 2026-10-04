import { useDraft } from "@sidioralabs/rex/client";
import { z } from "zod/mini";

const catalogFilter = z.object({ query: z.string().check(z.maxLength(40)) });

export function useCatalogFilter() {
  const draft = useDraft(catalogFilter);
  const query = draft.value?.query ?? "";
  return {
    query,
    setQuery: (next: string) => draft.set(next.trim() === "" ? null : { query: next }),
  };
}
