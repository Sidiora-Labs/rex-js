import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const pickToken = action("pick-token", {
  input: z.object({ symbol: text({ min: 1 }) }),
  output: z.object({ symbol: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick token",
  handler: (input) => input,
});
