import { region } from "@sidioralabs/rex/client";
import { REPOSITORY_URL } from "../../../../components/Shell.tsx";
import { useStandards } from "../../hooks/useStandards.ts";
import StandardCards from "./parts/StandardCards.tsx";
import StandardsSummary from "./parts/StandardsSummary.tsx";
import StandardsTable from "./parts/StandardsTable.tsx";

export default region("table", () => {
  const standards = useStandards();
  const data = standards.data;
  if (data === undefined) return null;
  return (
    <div className="flex flex-col gap-6">
      <StandardsSummary
        met={data.met}
        total={data.total}
        source={data.source}
        sourceHref={`${REPOSITORY_URL}/blob/main/${data.source}`}
      />
      <StandardsTable items={data.items} />
      <StandardCards items={data.items} />
    </div>
  );
});
