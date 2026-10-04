import { entity, id, money, text } from "@sidioralabs/rex";

export const account = entity("account", {
  fields: { id: id(), name: text({ min: 1 }), balance: money() },
  label: (record) => record.name,
});
