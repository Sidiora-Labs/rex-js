import { Img } from "@sidioralabs/rex/client/media";
import Tile from "./parts/Tile.tsx";

export default function GridRegion() {
  return (
    <section>
      <Img src="/images/cover.avif" alt="Gallery cover" width={1200} height={630} priority />
      <Tile src="/images/one.avif" label="One" />
    </section>
  );
}
