import { action } from "@sidioralabs/rex";
import { id, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { accountIdOf, accounts, contacts, nextId, requireAccount } from "../data/wallet.ts";
import { wallet } from "../policies/wallet.ts";

export const pickContact = action("pick-contact", {
  input: z.object({ contact: z.optional(id()) }),
  output: z.object({ contact: id(), name: text({ min: 1 }) }),
  policy: wallet.can("wallet.manage"),
  effect: "reversible",
  label: "Pick contact",
  shortcut: "shift+c",
  invalidates: ["wallet"],
  handler: async (input, ctx) => {
    const owner = await requireAccount(accountIdOf(ctx.actor.attributes));
    const known = (await contacts.list()).items;
    const chosen =
      input.contact ??
      nextId(
        known.map((entry) => entry.id),
        owner.sendContact,
      );
    const picked = known.find((entry) => entry.id === chosen);
    if (picked === undefined) throw new Error(`contact "${chosen}" is not in the address book`);
    await accounts.put({ ...owner, sendContact: picked.id });
    return { contact: picked.id, name: picked.name };
  },
});
