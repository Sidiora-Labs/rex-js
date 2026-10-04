import { RexError } from "@sidioralabs/rex";
import { region, useRegistry } from "@sidioralabs/rex/client";
import { useDetail } from "../../hooks/useDetail.ts";
import errorPage from "../../page.ts";
import CodeNeighbours from "./parts/CodeNeighbours.tsx";
import ErrorDetail from "./parts/ErrorDetail.tsx";

const CATALOG_PAGE = "errors";

export default region("detail", ({ nav }) => {
  const detail = useDetail();
  const registry = useRegistry();
  const data = detail.data;
  if (data === undefined) return null;
  const catalogPage = registry.find("page", CATALOG_PAGE);
  if (catalogPage === undefined) {
    throw new RexError(
      "REX301",
      `error ${data.code} links to page "${CATALOG_PAGE}", which is not registered`,
    );
  }
  const catalog = nav.href(catalogPage);
  if (!catalog.ok) throw new RexError("REX331", catalog.message);
  const link = (code: typeof data.code | null) => {
    if (code === null) return null;
    const outcome = nav.href(errorPage, { code });
    if (!outcome.ok) throw new RexError("REX331", outcome.message);
    return { code, href: outcome.href };
  };
  return (
    <div className="flex flex-col gap-10">
      <ErrorDetail
        code={data.code}
        prefix={data.prefix}
        areaTitle={data.areaTitle}
        message={data.message}
        hint={data.hint}
        docs={data.docs}
        doc={data.doc}
        catalogHref={catalog.href}
      />
      <CodeNeighbours previous={link(data.previous)} next={link(data.next)} />
    </div>
  );
});
