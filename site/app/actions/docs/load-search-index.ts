import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { buildSearchIndex } from "../../server/content/search.ts";

export const loadSearchIndex = action("load-search-index", {
  input: z.object({}),
  output: z.object({
    entries: z.array(
      z.object({
        section: text({ min: 1 }),
        title: text({ min: 1 }),
        route: text({ min: 1 }),
        headings: z.array(z.string()),
        summary: z.string(),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "Load search index",
  handler: async () => ({
    entries: (await buildSearchIndex()).map((entry) => ({
      ...entry,
      headings: [...entry.headings],
    })),
  }),
});
