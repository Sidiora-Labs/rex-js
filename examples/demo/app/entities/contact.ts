import { entity } from "@sidioralabs/rex";
import { id, text } from "@sidioralabs/rex/schema";

export const contact = entity("contact", {
  fields: { id: id(), name: text({ min: 1 }), address: text({ min: 1 }) },
  label: (record) => record.name,
});
