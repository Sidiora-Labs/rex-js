import { action, always, money, text, z } from "@sidioralabs/rex";

export const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "irreversible",
  label: "Send",
  handler: () => ({ ok: true }),
});
