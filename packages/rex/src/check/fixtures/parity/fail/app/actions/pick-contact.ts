import { action, always, text, z } from "@sidioralabs/rex";

export const pickContact = action("pick-contact", {
  input: z.object({ contact: text({ min: 1 }) }),
  output: z.object({ contact: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick contact",
  handler: (input) => input,
});
