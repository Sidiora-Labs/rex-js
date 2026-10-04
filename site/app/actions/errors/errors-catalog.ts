import { action, always } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { errorCatalog } from "../../server/content/errors.ts";

const errorEntry = z.object({
  code: z.string(),
  prefix: z.string(),
  areaTitle: z.string(),
  message: z.string(),
  hint: z.string(),
  docs: z.string(),
  route: z.string(),
});

const areaDoc = z.object({ slug: z.string(), title: z.string(), href: z.string() });

export const errorsCatalog = action("errors-catalog", {
  input: z.object({}),
  output: z.object({
    count: z.number(),
    areas: z.array(
      z.object({
        prefix: z.string(),
        title: z.string(),
        doc: areaDoc,
        entries: z.array(errorEntry),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "Read the error catalog",
  handler: () => errorCatalog(),
});
