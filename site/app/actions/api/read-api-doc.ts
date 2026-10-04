import { action, always } from "@sidioralabs/rex";
import { integer, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { readApiDoc as readApiArticle } from "../../server/content/api.ts";

export const readApiDoc = action("read-api-doc", {
  input: z.object({ slug: text({ min: 1, max: 80 }) }),
  output: z.object({
    slug: text({ min: 1 }),
    title: text({ min: 1 }),
    entry: text({ min: 1 }),
    route: text({ min: 1 }),
    source: text({ min: 1 }),
    summary: text({ min: 1 }),
    headings: z.array(
      z.object({ depth: integer({ min: 1, max: 6 }), id: z.string(), text: text({ min: 1 }) }),
    ),
    html: text({ min: 1 }),
  }),
  policy: always(),
  effect: "read",
  label: "Read API entry",
  handler: async (input) => {
    const article = await readApiArticle(input.slug);
    return {
      slug: article.slug,
      title: article.title,
      entry: article.entry,
      route: article.route,
      source: article.source,
      summary: article.summary,
      headings: article.headings.map((heading) => ({ ...heading })),
      html: article.html,
    };
  },
});
