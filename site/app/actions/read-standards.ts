import { action, always } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { readStandards as readStandardsTable } from "../server/content/standards.ts";

export const readStandards = action("read-standards", {
  input: z.object({}),
  output: z.object({
    source: z.string(),
    total: z.number(),
    met: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        area: z.string(),
        requirement: z.string(),
        status: z.enum(["met", "partial"]),
        recorded: z.string(),
        tasks: z.array(z.object({ id: z.string(), status: z.string() })),
      }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "Read the standards table",
  handler: () => readStandardsTable(),
});
