import { action, always, text } from "@sidioralabs/rex";
import { z } from "zod/mini";

export const addNote = action("add-note", {
  input: z.object({ title: text({ min: 1, max: 120 }) }),
  output: z.object({ title: text() }),
  policy: always(),
  effect: "reversible",
  label: "Add note",
  shortcut: "mod+n",
  handler: (input) => ({ title: input.title }),
});
