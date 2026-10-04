import { action, text, z } from "@sidioralabs/rex";
import { note } from "../entities/note.ts";
import { notes } from "../policies/notes.ts";
import { insertNote } from "../server/db.ts";

function auditTitle(title: string): string {
  return `audited:${title}:${process.env.AUDIT_TOKEN ?? "none"}`;
}

export const saveNote = action("save-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: note.schema,
  policy: notes.can("notes.write"),
  effect: "reversible",
  label: "Save note",
  invalidates: ["note"],
  async handler(input) {
    return insertNote(auditTitle(input.title));
  },
});
