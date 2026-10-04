import { anonymousActor, page } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { listApi } from "../../actions/api/list-api.ts";
import { readApiDoc } from "../../actions/api/read-api-doc.ts";

export default page("api-doc", {
  route: "/api/:slug",
  params: z.object({ slug: text({ min: 1, max: 80 }) }),
  render: "static",
  paths: async () => {
    const api = await listApi.handler({}, { actor: anonymousActor });
    return api.entries.map((entry) => ({ slug: entry.slug }));
  },
  load: {
    article: {
      action: readApiDoc,
      input: (params: Readonly<Record<string, unknown>>) => ({ slug: String(params.slug) }),
    },
  },
  chrome: { title: "API reference", back: "api" },
  regions: ["toc", "article"],
});
