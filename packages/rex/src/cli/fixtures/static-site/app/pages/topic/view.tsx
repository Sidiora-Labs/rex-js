import { Page, view } from "@sidioralabs/rex/client";
import BodyRegion from "./regions/body/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <BodyRegion />
  </Page.Stack>
));
