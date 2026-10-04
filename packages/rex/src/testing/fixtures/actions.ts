import { action, can, id, text } from "../../index.ts";
import { z } from "zod/mini";
import { addRecord, listRecords } from "./data.ts";

export const noteSchema = z.object({ id: id(), title: text({ min: 1 }) });

export const listNotes = action("list-notes", {
  input: z.object({}),
  output: z.object({ notes: z.array(noteSchema) }),
  policy: can("notes.read"),
  effect: "read",
  label: "List notes",
  handler: () => ({ notes: [...listRecords()] }),
});

export const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 80 }) }),
  output: noteSchema,
  policy: can("notes.write"),
  effect: "reversible",
  label: "Add note",
  invalidates: ["notes"],
  handler: (input) => addRecord(input.title),
});
