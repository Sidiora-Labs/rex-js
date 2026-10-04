import { useQuery } from "@tanstack/react-query";
import { region, useRexClient } from "../../../../../client/index.ts";
import { notesQuery } from "../../../notes-query.ts";

interface NoteParams {
  readonly noteId: string;
}

export default region<NoteParams>("detail", ({ params }) => {
  const notes = useQuery(notesQuery(useRexClient()));
  const found = (notes.data ?? []).find((note) => note.id === params.noteId);
  return <p data-note-detail={params.noteId}>{found === undefined ? "Unknown note" : found.title}</p>;
});
