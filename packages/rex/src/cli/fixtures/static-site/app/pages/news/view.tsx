import { Page, view } from "@sidioralabs/rex/client";
import LatestRegion from "./regions/latest/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <LatestRegion />
  </Page.Stack>
));
