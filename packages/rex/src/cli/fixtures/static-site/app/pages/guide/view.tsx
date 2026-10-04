import { Page, view } from "@sidioralabs/rex/client";
import IntroRegion from "./regions/intro/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <IntroRegion />
  </Page.Stack>
));
