import { region } from "@sidioralabs/rex/client";
import Thumb from "./parts/Thumb.tsx";

export default region("cover", () => (
  <section>
    <img src="/images/cover.png" alt="Gallery cover" />
    <Thumb src="/images/first.png" label="First photo" />
    <img src="/images/divider.png" />
  </section>
));
