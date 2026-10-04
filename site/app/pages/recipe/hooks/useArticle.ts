import { useLoader } from "@sidioralabs/rex/client";
import recipePage from "../page.ts";

export function useArticle() {
  return useLoader(recipePage, "article");
}
