import { region } from "@sidioralabs/rex/client";
import { useSearchIndex } from "../../hooks/useSearchIndex.ts";
import { useDocSearch } from "../../hooks/useDocSearch.ts";
import DocSearch from "./parts/DocSearch.tsx";

export default region("search", () => {
  const index = useSearchIndex();
  const search = useDocSearch(index.data !== undefined);
  if (index.data === undefined) return null;
  return (
    <DocSearch
      {...search}
      entries={index.data.entries}
      onOpen={(route) => {
        window.location.assign(route);
      }}
    />
  );
});
