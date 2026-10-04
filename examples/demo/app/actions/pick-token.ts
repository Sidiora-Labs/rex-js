import { action, id, text } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { accountIdOf, accounts, nextId, requireAccount, tokens } from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const pickToken = action("pick-token", {
  input: z.object({ token: z.optional(id()) }),
  output: z.object({ token: id(), symbol: text({ min: 1 }) }),
  policy: wallet.can("wallet.manage"),
  effect: "reversible",
  label: "Pick token",
  shortcut: "shift+t",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const held = (await tokens.list()).items;
    const chosen =
      input.token ??
      nextId(
        held.map((entry) => entry.id),
        owner.sendToken,
      );
    const picked = held.find((entry) => entry.id === chosen);
    if (picked === undefined) throw new Error(`token "${chosen}" is not in this wallet`);
    await accounts.put({ ...owner, sendToken: picked.id });
    return { token: picked.id, symbol: picked.symbol };
  },
});
