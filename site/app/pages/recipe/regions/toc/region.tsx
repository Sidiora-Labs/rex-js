import { region } from "@sidioralabs/rex/client";
import Toc from "../../../../components/Toc.tsx";
import { useArticle } from "../../hooks/useArticle.ts";

export default region("toc", () => {
  const article = useArticle();
  if (article.data === undefined) return null;
  return <Toc headings={article.data.headings} />;
});
