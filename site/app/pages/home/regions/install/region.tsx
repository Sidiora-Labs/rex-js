import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import Install from "./parts/Install.tsx";

export default region("install", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return <Install version={meta.data.version} />;
});
