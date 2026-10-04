import { entity, id, text } from "@sidioralabs/rex";

export const note = entity("note", {
  fields: { id: id(), title: text({ min: 1, max: 120 }) },
  label: (record) => record.title,
});
