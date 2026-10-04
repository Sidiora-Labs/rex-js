import { DECLARATION_KINDS, INVOCATION_ROUTES, action, always } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { readRexMeta } from "../../server/content/meta.ts";

export const readHomeMeta = action("read-home-meta", {
  input: z.object({}),
  output: z.object({
    version: z.string(),
    errorCodes: z.int(),
    checkerRules: z.int(),
    clientBudgetKb: z.number(),
    dataStates: z.int(),
    declarationKinds: z.array(z.enum(DECLARATION_KINDS)),
    invocationRoutes: z.array(z.enum(INVOCATION_ROUTES)),
  }),
  policy: always(),
  effect: "read",
  label: "Read the Rex facts",
  handler: () => readRexMeta(),
});
