import { region } from "../../../../../client/index.ts";
import { useNotes } from "../../hooks/useNotes.ts";
import NoteList from "./parts/NoteList.tsx";

interface NotesParams {
  readonly filter?: string;
}

export default region<NotesParams>("list", ({ params }) => {
  const notes = useNotes();
  const needle = (params.filter ?? "").toLowerCase();
  const shown = (notes.data ?? []).filter((note) => note.title.toLowerCase().includes(needle));
  return <NoteList notes={shown} />;
});
