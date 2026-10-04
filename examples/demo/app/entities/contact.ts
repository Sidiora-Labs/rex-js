import { entity, id, text } from "@sidioralabs/rex";

export const contact = entity("contact", {
  fields: { id: id(), name: text({ min: 1 }), address: text({ min: 1 }) },
  label: (record) => record.name,
});
