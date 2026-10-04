import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { apiPackage, listApi as readApiList } from "../../server/content/api.ts";

const symbol = z.object({ name: text({ min: 1 }), id: text({ min: 1 }) });

export const listApi = action("list-api", {
  input: z.object({}),
  output: z.object({
    package: text({ min: 1 }),
    version: text({ min: 1 }),
    entries: z.array(
      z.object({
        slug: text({ min: 1 }),
        title: text({ min: 1 }),
        entry: text({ min: 1 }),
        route: text({ min: 1 }),
        summary: text({ min: 1 }),
        kinds: z.array(
          z.object({ title: text({ min: 1 }), id: text({ min: 1 }), symbols: z.array(symbol) }),
        ),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "List API entries",
  handler: async () => {
    const pkg = apiPackage();
    const entries = await readApiList();
    return {
      package: pkg.name,
      version: pkg.version,
      entries: entries.map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        entry: entry.entry,
        route: entry.route,
        summary: entry.summary,
        kinds: entry.kinds.map((kind) => ({
          title: kind.title,
          id: kind.id,
          symbols: kind.symbols.map((item) => ({ name: item.name, id: item.id })),
        })),
      })),
    };
  },
});
