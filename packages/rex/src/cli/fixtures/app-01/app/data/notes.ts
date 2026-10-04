import { bind, memoryStore } from "@sidioralabs/rex";
import { note } from "../entities/note.ts";

export const notes = bind(
  note,
  memoryStore(note, [{ id: "welcome", name: "Welcome to Rex" }]),
);
