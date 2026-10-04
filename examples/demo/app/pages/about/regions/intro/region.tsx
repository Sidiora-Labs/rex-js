import { region } from "@sidioralabs/rex/client";
import { useT } from "@sidioralabs/rex/client/i18n";
import AboutIntro from "./parts/AboutIntro.tsx";

export default region("intro", () => {
  const t = useT();
  return <AboutIntro heading={t("about.heading")} />;
});
