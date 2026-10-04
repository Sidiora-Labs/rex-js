import { region } from "@sidioralabs/rex/client";
import { useSearchIndex } from "../../hooks/useSearchIndex.ts";
import DocSearch from "./parts/DocSearch.tsx";

export default region("search", () => {
  const index = useSearchIndex();
  if (index.data === undefined) return null;
  return (
    <DocSearch
      entries={index.data.entries}
      onOpen={(route) => {
        window.location.assign(route);
      }}
    />
  );
});
