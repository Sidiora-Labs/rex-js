import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { listDocs as readDocList } from "../../server/content/docs.ts";

const docEntry = z.object({
  slug: text({ min: 1 }),
  title: text({ min: 1 }),
  route: text({ min: 1 }),
  summary: z.string(),
});

export const listDocs = action("list-docs", {
  input: z.object({}),
  output: z.object({ guides: z.array(docEntry), recipes: z.array(docEntry) }),
  policy: always(),
  effect: "read",
  label: "List docs",
  handler: async () => {
    const [guides, recipes] = await Promise.all([readDocList("guide"), readDocList("recipe")]);
    const entry = (doc: (typeof guides)[number]) => ({
      slug: doc.slug,
      title: doc.title,
      route: doc.route,
      summary: doc.summary,
    });
    return { guides: guides.map(entry), recipes: recipes.map(entry) };
  },
});
