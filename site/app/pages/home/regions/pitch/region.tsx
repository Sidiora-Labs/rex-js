import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import Rules from "./parts/Rules.tsx";

export default region("pitch", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return <Rules checkerRules={meta.data.checkerRules} />;
});
