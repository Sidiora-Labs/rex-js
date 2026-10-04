import { region } from "@sidioralabs/rex/client";
import Prose from "../../../../components/Prose.tsx";
import { Badge } from "../../../../components/ui/badge.tsx";
import { useApiArticle } from "../../hooks/useApiArticle.ts";

export default region("article", () => {
  const article = useApiArticle();
  if (article.data === undefined) return null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Badge variant="tonal" className="font-mono" data-site-api-entry={article.data.entry}>
          {article.data.entry}
        </Badge>
        <p className="m-0 text-sm text-muted-foreground" data-site-api-summary="">
          {article.data.summary}
        </p>
      </div>
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
