import { action } from "@sidioralabs/rex";
import { boolean, money } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { accountIdOf, walletOverview } from "../data/wallet.ts";
import { account } from "../entities/account.ts";
import { contact } from "../entities/contact.ts";
import { token } from "../entities/token.ts";
import { viewer } from "../policies/viewer.ts";

export const loadWallet = action("load-wallet", {
  input: z.object({}),
  output: z.object({
    account: z.object(account.fields),
    tokens: z.array(
      z.object({
        ...token.fields,
        valueUsd: money(),
        dust: boolean(),
        change24hPct: z.string(),
      }),
    ),
    contacts: z.array(z.object(contact.fields)),
    totalUsd: money(),
    change24hUsd: z.string(),
    change24hPct: z.string(),
  }),
  policy: viewer.can("viewer.read"),
  effect: "read",
  label: "Load wallet",
  handler: (_input, ctx) => walletOverview(accountIdOf(ctx.actor.attributes)),
});
