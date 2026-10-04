import { region } from "@sidioralabs/rex/client";
import Toc from "../../../../components/Toc.tsx";
import { useApiArticle } from "../../hooks/useApiArticle.ts";

export default region("toc", () => {
  const article = useApiArticle();
  if (article.data === undefined) return null;
  return <Toc headings={article.data.headings} />;
});
