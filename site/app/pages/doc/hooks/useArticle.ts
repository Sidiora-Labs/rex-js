import { useLoader } from "@sidioralabs/rex/client";
import docPage from "../page.ts";

export function useArticle() {
  return useLoader(docPage, "article");
}
