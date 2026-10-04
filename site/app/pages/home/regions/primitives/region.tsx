import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import Primitives from "./parts/Primitives.tsx";

export default region("primitives", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return <Primitives kinds={meta.data.declarationKinds} />;
});
