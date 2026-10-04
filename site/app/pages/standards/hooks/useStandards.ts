import { useLoader } from "@sidioralabs/rex/client";
import standardsPage from "../page.ts";

export function useStandards() {
  return useLoader(standardsPage, "standards");
}
