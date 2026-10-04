import { action, always } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const pickContact = action("pick-contact", {
  input: z.object({ contact: text({ min: 1 }) }),
  output: z.object({ contact: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick contact",
  handler: (input) => input,
});
