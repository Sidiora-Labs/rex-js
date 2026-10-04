import { useState } from "react";
import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
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
