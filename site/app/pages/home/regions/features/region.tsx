import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import Features from "./parts/Features.tsx";

export default region("features", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return (
    <Features
      errorCodes={meta.data.errorCodes}
      dataStates={meta.data.dataStates}
      clientBudgetKb={meta.data.clientBudgetKb}
    />
  );
});
