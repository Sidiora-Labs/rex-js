import { useLoader } from "@sidioralabs/rex/client";
import changelogPage from "../page.ts";

export function useChangelog() {
  return useLoader(changelogPage, "changelog");
}
