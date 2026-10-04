import { region } from "@sidioralabs/rex/client";
import Prose from "../../../../components/Prose.tsx";
import { useArticle } from "../../hooks/useArticle.ts";

export default region("article", () => {
  const article = useArticle();
  if (article.data === undefined) return null;
  return (
    <div className="flex flex-col gap-6">
      <Prose html={article.data.html} />
      <a
        href={article.data.source}
        rel="noopener"
        data-site-source={article.data.slug}
        className="focus-ring inline-flex min-h-9 items-center self-start rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground pointer-coarse:min-h-11"
      >
        View the source of this page on GitHub
      </a>
    </div>
  );
});
