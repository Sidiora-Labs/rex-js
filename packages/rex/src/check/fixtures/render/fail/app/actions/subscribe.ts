import { action, always, text } from "@sidioralabs/rex";
import { z } from "zod/mini";

export const subscribe = action("subscribe", {
  input: z.object({ email: text({ min: 3, max: 120 }) }),
  output: z.object({ email: text() }),
  policy: always(),
  effect: "reversible",
  label: "Subscribe",
  handler: (input) => ({ email: input.email }),
});
