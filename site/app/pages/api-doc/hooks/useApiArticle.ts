import { useLoader } from "@sidioralabs/rex/client";
import apiDocPage from "../page.ts";

export function useApiArticle() {
  return useLoader(apiDocPage, "article");
}
