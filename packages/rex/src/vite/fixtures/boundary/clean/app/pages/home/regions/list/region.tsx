const heading: string = import.meta.env.VITE_NOTES_HEADING ?? "Notes";
const mode = process.env.NODE_ENV;

export default function List() {
  return (
    <section data-rex-region="home/list">
      {heading} ({mode})
    </section>
  );
}
