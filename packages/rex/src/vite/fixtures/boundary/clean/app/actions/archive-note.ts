import { action, id } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { note } from "../entities/note.ts";
import { notes } from "../policies/notes.ts";
import { archiveNote } from "../server/db.ts";

const handler = (input: { id: string }) => archiveNote(input.id);

export const archive = action("archive-note", {
  input: z.object({ id: id() }),
  output: note.schema,
  policy: notes.can("notes.write"),
  effect: "reversible",
  label: "Archive note",
  invalidates: ["note"],
  handler,
});
