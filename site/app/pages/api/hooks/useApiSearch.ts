import { useLoader } from "@sidioralabs/rex/client";
import apiPage from "../page.ts";

export function useApiSearch() {
  return useLoader(apiPage, "search");
}
