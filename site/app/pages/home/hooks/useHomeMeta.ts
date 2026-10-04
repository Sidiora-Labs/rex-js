import type { ActionOutput } from "@sidioralabs/rex";
import { useLoader, type RexLoaderError } from "@sidioralabs/rex/client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { readHomeMeta } from "../../../actions/home/read-home-meta.ts";
import homePage from "../page.ts";

export function useHomeMeta(): UseQueryResult<ActionOutput<typeof readHomeMeta>, RexLoaderError> {
  return useLoader(homePage, "meta") as UseQueryResult<
    ActionOutput<typeof readHomeMeta>,
    RexLoaderError
  >;
}
