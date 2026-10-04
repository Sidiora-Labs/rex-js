import { region } from "@sidioralabs/rex/client";
import { useHomeMeta } from "../../hooks/useHomeMeta.ts";
import Hero from "./parts/Hero.tsx";

export default region("hero", () => {
  const meta = useHomeMeta();
  if (meta.data === undefined) return null;
  return <Hero version={meta.data.version} />;
});
