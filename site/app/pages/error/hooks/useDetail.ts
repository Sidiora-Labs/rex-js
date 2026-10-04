import { useLoader } from "@sidioralabs/rex/client";
import errorPage from "../page.ts";

export function useDetail() {
  return useLoader(errorPage, "detail");
}
