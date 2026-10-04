import type { NoteRecord } from "../../../../data.ts";

export interface NoteListProps {
  readonly notes: readonly NoteRecord[];
}

export default function NoteList({ notes }: NoteListProps) {
  return (
    <ul aria-label="Notes">
      {notes.map((note) => (
        <li key={note.id} data-note={note.id}>
          {note.title}
        </li>
      ))}
    </ul>
  );
}
