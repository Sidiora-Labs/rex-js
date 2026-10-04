import { action, always } from "@sidioralabs/rex";
import { id, money, text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";
import { tokenPrices } from "../data/wallet.ts";

export const listTokens = action("list-tokens", {
  input: z.object({}),
  output: z.object({
    tokens: z.array(
      z.object({ id: id(), symbol: text({ min: 1 }), name: text({ min: 1 }), priceUsd: money() }),
    ),
  }),
  policy: always(),
  effect: "read",
  label: "List tokens",
  handler: async () => ({ tokens: await tokenPrices() }),
});
