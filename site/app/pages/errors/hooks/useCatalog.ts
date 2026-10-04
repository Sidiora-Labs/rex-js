import { useLoader } from "@sidioralabs/rex/client";
import errorsPage from "../page.ts";

export function useCatalog() {
  return useLoader(errorsPage, "catalog");
}
