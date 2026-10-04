import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ token: text({ min: 1 }), amount: money(), to: text({ min: 1 }) }),
  output: z.object({ ok: z.boolean() }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  invalidates: ["tokens"],
  handler: () => ({ ok: true }),
});
