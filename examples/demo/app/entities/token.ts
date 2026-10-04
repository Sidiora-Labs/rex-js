import { entity, id, money, text } from "@sidioralabs/rex";

export const token = entity("token", {
  fields: {
    id: id(),
    symbol: text({ min: 1, max: 12 }),
    name: text({ min: 1 }),
    balance: money(),
    priceUsd: money(),
  },
  label: (record) => `${record.name} (${record.symbol})`,
});
