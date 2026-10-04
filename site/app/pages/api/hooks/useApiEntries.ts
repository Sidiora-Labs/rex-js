import { useLoader } from "@sidioralabs/rex/client";
import apiPage from "../page.ts";

export function useApiEntries() {
  return useLoader(apiPage, "entries");
}
