import { useMemo } from "react";
import { action } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { wallet } from "../../policies/wallet.ts";
import { ledgerBalance } from "../../server/ledger.ts";

export const receive = action("receive", {
  input: z.object({ token: text({ min: 1 }) }),
  output: z.object({ balance: z.number(), memo: z.string() }),
  policy: wallet.can("view"),
  effect: "read",
  label: "Receive",
  handler: async (input) => ({
    balance: await ledgerBalance(input.token),
    memo: typeof useMemo,
  }),
});
