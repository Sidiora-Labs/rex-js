import Tile from "./parts/Tile.tsx";

export default function GridRegion() {
  return (
    <section>
      <img src="/images/cover.avif" alt="Gallery cover" />
      <Tile src="/images/one.avif" label="One" />
    </section>
  );
}
