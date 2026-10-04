import { RexError } from "@sidioralabs/rex";
import { region, useRegistry } from "@sidioralabs/rex/client";
import { useCatalog } from "../../hooks/useCatalog.ts";
import { useCatalogFilter } from "../../hooks/useCatalogFilter.ts";
import AreaSection from "./parts/AreaSection.tsx";
import CatalogFilter from "./parts/CatalogFilter.tsx";
import CatalogIntro from "./parts/CatalogIntro.tsx";
import NoMatch from "./parts/NoMatch.tsx";

const ERROR_PAGE = "error";

function matches(needle: string, entry: { readonly code: string; readonly message: string }) {
  return (
    needle === "" ||
    entry.code.toLowerCase().includes(needle) ||
    entry.message.toLowerCase().includes(needle)
  );
}

export default region("catalog", ({ nav }) => {
  const catalog = useCatalog();
  const filter = useCatalogFilter();
  const registry = useRegistry();
  const data = catalog.data;
  if (data === undefined) return null;
  const errorPage = registry.find("page", ERROR_PAGE);
  if (errorPage === undefined) {
    throw new RexError(
      "REX301",
      `the error catalog links to page "${ERROR_PAGE}", which is not registered`,
    );
  }
  const hrefOf = (code: string) => {
    const outcome = nav.href(errorPage, { code });
    if (!outcome.ok) throw new RexError("REX331", outcome.message);
    return outcome.href;
  };
  const needle = filter.query.trim().toLowerCase();
  const areas = data.areas
    .map((area) => ({
      ...area,
      entries: area.entries
        .filter((entry) => matches(needle, entry))
        .map((entry) => ({
          code: entry.code,
          message: entry.message,
          hint: entry.hint,
          href: hrefOf(entry.code),
        })),
    }))
    .filter((area) => area.entries.length > 0);
  const shown = areas.reduce((sum, area) => sum + area.entries.length, 0);
  return (
    <div className="flex flex-col gap-8">
      <CatalogIntro count={data.count} areas={data.areas.length} />
      <CatalogFilter
        query={filter.query}
        shown={shown}
        total={data.count}
        onQuery={filter.setQuery}
      />
      {areas.length === 0 ? <NoMatch query={filter.query} /> : null}
      {areas.map((area) => (
        <AreaSection
          key={area.prefix}
          prefix={area.prefix}
          title={area.title}
          doc={area.doc}
          entries={area.entries}
        />
      ))}
    </div>
  );
});
