import Lede from "./parts/Lede.tsx";
import Rendered from "./parts/Rendered.tsx";

export default function BodyRegion() {
  const body = "<p>Signed <em>release</em> notes</p>";
  return (
    <article className="stack gap-4">
      <Lede text="<script>alert(1)</script> stays text" />
      <Rendered html={body} />
    </article>
  );
}
