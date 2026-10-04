import Excerpt from "./parts/Excerpt.tsx";

export default function BodyRegion({ body }: { readonly body: string }) {
  return (
    <article>
      <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
      <Excerpt html={body} />
    </article>
  );
}
