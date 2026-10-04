import { action } from "@sidioralabs/rex";
import { money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import {
  DEFAULT_SEND_AMOUNT,
  accountIdOf,
  accounts,
  contacts,
  fromUnits,
  requireAccount,
  toUnits,
  tokens,
} from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const send = action("send", {
  input: z.object({ amount: z._default(money(), DEFAULT_SEND_AMOUNT) }),
  output: z.object({ transfer: text({ min: 1 }), balance: money() }),
  policy: wallet.requires({ unlocked: true, account: true, permissions: ["wallet.send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  form: { redirect: "/send" },
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const held = await tokens.get(owner.sendToken);
    const recipient = await contacts.get(owner.sendContact);
    if (held === undefined) throw new Error(`token "${owner.sendToken}" is not in this wallet`);
    if (recipient === undefined) throw new Error(`contact "${owner.sendContact}" is unknown`);
    const units = toUnits(input.amount);
    if (units <= 0n) throw new Error("the amount must be greater than zero");
    const remaining = toUnits(held.balance) - units;
    if (remaining < 0n) throw new Error(`the ${held.symbol} balance is too low`);
    const balance = fromUnits(remaining);
    await tokens.put({ ...held, balance });
    const transfer = `Sent ${fromUnits(units)} ${held.symbol} to ${recipient.name}`;
    await accounts.put({ ...owner, lastTransfer: transfer });
    return { transfer, balance };
  },
});
