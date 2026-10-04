import { Page, view } from "@sidioralabs/rex/client";
import CoverRegion from "./regions/cover/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <CoverRegion />
  </Page.Stack>
));
