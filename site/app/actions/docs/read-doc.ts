import { action, always } from "@sidioralabs/rex";
import { enumOf, integer, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { readDoc as readDocArticle } from "../../server/content/docs.ts";

export const readDoc = action("read-doc", {
  input: z.object({ kind: enumOf(["guide", "recipe"]), slug: text({ min: 1, max: 80 }) }),
  output: z.object({
    kind: enumOf(["guide", "recipe"]),
    slug: text({ min: 1 }),
    title: text({ min: 1 }),
    route: text({ min: 1 }),
    source: text({ min: 1 }),
    summary: z.string(),
    headings: z.array(
      z.object({ depth: integer({ min: 1, max: 6 }), id: z.string(), text: text({ min: 1 }) }),
    ),
    html: text({ min: 1 }),
  }),
  policy: always(),
  effect: "read",
  label: "Read doc",
  handler: async (input) => {
    const article = await readDocArticle(input.kind, input.slug);
    return {
      kind: article.kind,
      slug: article.slug,
      title: article.title,
      route: article.route,
      source: article.source,
      summary: article.summary,
      headings: article.headings.map((heading) => ({ ...heading })),
      html: article.html,
    };
  },
});
