import { entity } from "@sidioralabs/rex";
import { boolean, integer, ref, text } from "@sidioralabs/rex/schema";
import { account } from "./account.ts";

export const token = entity("token", {
  fields: {
    symbol: text({ min: 1 }),
    decimals: integer({ min: 0 }),
    account: ref(account),
    dust: boolean().optional(),
  },
  key: "symbol",
  label: (record) => record.symbol,
});
