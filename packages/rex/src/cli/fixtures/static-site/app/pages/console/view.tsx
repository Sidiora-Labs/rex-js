import { Page, view } from "@sidioralabs/rex/client";
import PanelRegion from "./regions/panel/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <PanelRegion />
  </Page.Stack>
));
