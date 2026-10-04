import { action, always, text } from "@sidioralabs/rex";
import { z } from "zod/mini";

export const pickToken = action("pick-token", {
  input: z.object({ symbol: text({ min: 1 }) }),
  output: z.object({ symbol: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Pick token",
  handler: (input) => input,
});
