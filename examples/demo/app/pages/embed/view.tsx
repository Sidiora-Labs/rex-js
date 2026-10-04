import { Page, view } from "@sidioralabs/rex/client";
import LocaleRegion from "./regions/locale/region.tsx";
import WidgetRegion from "./regions/widget/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <WidgetRegion />
    <LocaleRegion />
  </Page.Stack>
));
