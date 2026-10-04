import { RexError } from "@sidioralabs/rex";
import { region, useRegistry } from "@sidioralabs/rex/client";
import { useApiSearch } from "../../hooks/useApiSearch.ts";
import ApiSearch from "./parts/ApiSearch.tsx";

const API_DOC_PAGE = "api-doc";

export default region("search", ({ nav }) => {
  const index = useApiSearch();
  const registry = useRegistry();
  if (index.data === undefined) return null;
  const apiDoc = registry.find("page", API_DOC_PAGE);
  if (apiDoc === undefined) {
    throw new RexError(
      "REX301",
      `the API search opens page "${API_DOC_PAGE}", which is not registered`,
    );
  }
  return (
    <ApiSearch
      entries={index.data.entries}
      onOpen={(slug) => {
        const outcome = nav.to(apiDoc, { slug });
        if (!outcome.ok) throw new RexError("REX331", outcome.message);
      }}
    />
  );
});
