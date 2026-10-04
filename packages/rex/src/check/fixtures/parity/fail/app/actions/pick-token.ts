import { action, always, text, z } from "@sidioralabs/rex";

export const pickToken = action("pick-token", {
  input: z.object({ symbol: text({ min: 1 }) }),
  output: z.object({ symbol: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick token",
  handler: (input) => input,
});
