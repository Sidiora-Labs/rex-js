import { action, always, z } from "@sidioralabs/rex";

export const ping = action("ping", {
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Ping",
  handler: () => ({ ok: true }),
});
