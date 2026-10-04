import { Page, view } from "@sidioralabs/rex/client";
import WelcomeRegion from "./regions/welcome/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <WelcomeRegion />
  </Page.Stack>
));
