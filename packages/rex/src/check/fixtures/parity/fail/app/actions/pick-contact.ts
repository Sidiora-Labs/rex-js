import { action, always, text } from "@sidioralabs/rex";
import { z } from "zod/mini";

export const pickContact = action("pick-contact", {
  input: z.object({ contact: text({ min: 1 }) }),
  output: z.object({ contact: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick contact",
  handler: (input) => input,
});
