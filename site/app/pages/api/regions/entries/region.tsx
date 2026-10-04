import { RexError } from "@sidioralabs/rex";
import { region, useRegistry } from "@sidioralabs/rex/client";
import { useApiEntries } from "../../hooks/useApiEntries.ts";
import EntriesIntro from "./parts/EntriesIntro.tsx";
import EntryCard from "./parts/EntryCard.tsx";

const API_DOC_PAGE = "api-doc";

export default region("entries", ({ nav }) => {
  const entries = useApiEntries();
  const registry = useRegistry();
  const data = entries.data;
  if (data === undefined) return null;
  const apiDoc = registry.find("page", API_DOC_PAGE);
  if (apiDoc === undefined) {
    throw new RexError(
      "REX301",
      `the API index links to page "${API_DOC_PAGE}", which is not registered`,
    );
  }
  const hrefOf = (slug: string) => {
    const outcome = nav.href(apiDoc, { slug });
    if (!outcome.ok) throw new RexError("REX331", outcome.message);
    return outcome.href;
  };
  return (
    <div className="flex flex-col gap-6">
      <EntriesIntro packageName={data.package} version={data.version} count={data.entries.length} />
      <div className="flex flex-col gap-4">
        {data.entries.map((entry) => (
          <EntryCard
            key={entry.slug}
            slug={entry.slug}
            title={entry.title}
            entry={entry.entry}
            summary={entry.summary}
            href={hrefOf(entry.slug)}
            kinds={entry.kinds}
          />
        ))}
      </div>
    </div>
  );
});
