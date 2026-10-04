import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import HowItWorks from "./parts/HowItWorks.tsx";

export default region("how-it-works", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return <HowItWorks routes={meta.data.invocationRoutes} />;
});
