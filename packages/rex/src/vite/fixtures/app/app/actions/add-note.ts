import { action, text, z } from "@sidioralabs/rex";
import { note } from "../entities/note.ts";
import { notes } from "../policies/notes.ts";

export const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: note.schema,
  policy: notes.can("notes.write"),
  effect: "reversible",
  label: "Add note",
  shortcut: "mod+n",
  invalidates: ["note"],
  handler: (input) => ({ id: `note-${input.title.length}`, title: input.title }),
});
