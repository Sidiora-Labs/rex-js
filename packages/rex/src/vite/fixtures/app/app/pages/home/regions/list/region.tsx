import { useNotes } from "../../hooks/useNotes.ts";
import NoteRow from "./parts/NoteRow.tsx";

export default function List() {
  const titles = useNotes();
  return (
    <section data-rex-region="home/list">
      <ul>
        {titles.map((title) => (
          <NoteRow key={title} title={title} />
        ))}
      </ul>
    </section>
  );
}
