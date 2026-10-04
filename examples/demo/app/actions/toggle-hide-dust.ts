import { action, boolean, z } from "@sidioralabs/rex";
import { accountIdOf, accounts, requireAccount } from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const toggleHideDust = action("toggle-hide-dust", {
  input: z.object({ hide: boolean().optional() }),
  output: z.object({ hideDust: boolean() }),
  policy: wallet.can("wallet.manage"),
  effect: "reversible",
  label: "Toggle hide dust",
  shortcut: "shift+d",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const hideDust = input.hide ?? !owner.hideDust;
    await accounts.put({ ...owner, hideDust });
    return { hideDust };
  },
});
