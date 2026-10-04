import { action, boolean, money } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { accountIdOf, walletOverview } from "../data/wallet.ts";
import { account } from "../entities/account.ts";
import { contact } from "../entities/contact.ts";
import { token } from "../entities/token.ts";
import { viewer } from "../policies/viewer.ts";

export const loadWallet = action("load-wallet", {
  input: z.object({}),
  output: z.object({
    account: account.schema,
    tokens: z.array(z.object({ ...token.schema.shape, valueUsd: money(), dust: boolean() })),
    contacts: z.array(contact.schema),
    totalUsd: money(),
  }),
  policy: viewer.can("viewer.read"),
  effect: "read",
  label: "Load wallet",
  handler: (_input, ctx) => walletOverview(accountIdOf(ctx.actor.attributes)),
});
