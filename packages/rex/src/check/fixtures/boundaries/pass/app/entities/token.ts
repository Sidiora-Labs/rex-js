import { entity, type InferEntity } from "@sidioralabs/rex";
import { enumOf, id, integer, text } from "@sidioralabs/rex/schema";

export const token = entity("token", {
  fields: {
    id: id(),
    symbol: text({ min: 1 }),
    decimals: integer({ min: 0 }),
    network: enumOf(["paxeer", "ethereum"]),
  },
  label: (record) => record.symbol,
});

export type Token = InferEntity<typeof token>;
