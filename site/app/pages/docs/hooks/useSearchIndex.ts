import { useLoader } from "@sidioralabs/rex/client";
import docsPage from "../page.ts";

export function useSearchIndex() {
  return useLoader(docsPage, "search");
}
