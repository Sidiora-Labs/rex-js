import { Page, view } from "@sidioralabs/rex/client";
import ReleasesRegion from "./regions/releases/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <ReleasesRegion />
  </Page.Stack>
));
