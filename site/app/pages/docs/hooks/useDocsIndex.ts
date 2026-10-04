import { useLoader } from "@sidioralabs/rex/client";
import docsPage from "../page.ts";

export function useDocsIndex() {
  return useLoader(docsPage, "docs");
}
