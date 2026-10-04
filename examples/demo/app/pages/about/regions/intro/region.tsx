import { region, useT } from "@sidioralabs/rex/client";
import AboutIntro from "./parts/AboutIntro.tsx";

export default region("intro", () => {
  const t = useT();
  return <AboutIntro heading={t("about.heading")} />;
});
