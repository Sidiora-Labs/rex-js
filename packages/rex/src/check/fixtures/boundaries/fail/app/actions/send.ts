import { useState } from "react";
import { action, money, text } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ token: text({ min: 1 }), amount: money() }),
  output: z.object({ ok: z.boolean(), state: z.string() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  label: "Send",
  handler: () => ({ ok: true, state: typeof useState }),
});
