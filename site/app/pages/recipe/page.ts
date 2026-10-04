import { anonymousActor, page } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { listDocs } from "../../actions/docs/list-docs.ts";
import { readDoc } from "../../actions/docs/read-doc.ts";

export default page("recipe", {
  route: "/docs/recipes/:slug",
  params: z.object({ slug: text({ min: 1, max: 80 }) }),
  render: "static",
  paths: async () => {
    const docs = await listDocs.handler({}, { actor: anonymousActor });
    return docs.recipes.map((doc) => ({ slug: doc.slug }));
  },
  load: {
    article: {
      action: readDoc,
      input: (params: Readonly<Record<string, unknown>>) => ({
        kind: "recipe",
        slug: String(params.slug),
      }),
    },
  },
  chrome: { title: "Recipe", back: "docs" },
  regions: ["toc", "article"],
});
