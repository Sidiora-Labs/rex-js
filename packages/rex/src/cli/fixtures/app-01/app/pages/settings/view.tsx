import { Page, view } from "@sidioralabs/rex/client";
import ThemeRegion from "./regions/theme/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <ThemeRegion />
  </Page.Stack>
));
