import { region } from "@sidioralabs/rex/client";
import { useLocale, useT } from "@sidioralabs/rex/client/i18n";
import LocaleSwitch from "./parts/LocaleSwitch.tsx";

export default region("locale", () => {
  const t = useT();
  const locale = useLocale();
  return (
    <LocaleSwitch
      heading={t("locale.heading")}
      current={locale.locale}
      options={locale.locales.map((code) => ({ code, name: t(`locale.${code}`) }))}
      onSelect={locale.set}
    />
  );
});
