import { region } from "@sidioralabs/rex/client";
import { useDocsIndex } from "../../hooks/useDocsIndex.ts";
import DocList from "./parts/DocList.tsx";

export default region("index", () => {
  const docs = useDocsIndex();
  if (docs.data === undefined) return null;
  return (
    <div className="flex flex-col gap-10">
      <DocList title="Guides" docs={docs.data.guides} />
      <DocList title="Recipes" docs={docs.data.recipes} />
    </div>
  );
});
