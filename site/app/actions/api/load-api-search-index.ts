import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { listApi } from "../../server/content/api.ts";
import { API_SECTION, searchSection } from "../../server/content/search.ts";

export const loadApiSearchIndex = action("load-api-search-index", {
  input: z.object({}),
  output: z.object({
    entries: z.array(
      z.object({
        slug: text({ min: 1 }),
        title: text({ min: 1 }),
        route: text({ min: 1 }),
        headings: z.array(z.string()),
        summary: z.string(),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "Load API search index",
  handler: async () => {
    const [entries, articles] = await Promise.all([searchSection(API_SECTION), listApi()]);
    const slugs = new Map(articles.map((article) => [article.route, article.slug]));
    return {
      entries: entries.map((entry) => {
        const slug = slugs.get(entry.route);
        if (slug === undefined) {
          throw new Error(`rex-site: the API search entry ${entry.route} has no API page`);
        }
        return {
          slug,
          title: entry.title,
          route: entry.route,
          headings: [...entry.headings],
          summary: entry.summary,
        };
      }),
    };
  },
});
