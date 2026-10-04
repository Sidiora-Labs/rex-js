import { entity } from "@sidioralabs/rex";
import { id, text } from "@sidioralabs/rex/schema";

export const note = entity("note", {
  fields: { id: id(), title: text({ min: 1, max: 120 }) },
  label: (record) => record.title,
});
