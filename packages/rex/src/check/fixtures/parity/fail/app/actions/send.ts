import { action, always } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "irreversible",
  label: "Send",
  handler: () => ({ ok: true }),
});
