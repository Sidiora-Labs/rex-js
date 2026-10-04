import { entity, id, text } from "@sidioralabs/rex";

export const note = entity("note", {
  fields: { id: id(), name: text({ min: 1 }) },
  label: (record) => record.name,
});
