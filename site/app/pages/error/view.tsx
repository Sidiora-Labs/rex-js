import { Page, view } from "@sidioralabs/rex/client";
import DetailRegion from "./regions/detail/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <DetailRegion />
  </Page.Stack>
));
