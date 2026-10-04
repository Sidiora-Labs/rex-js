import { Page, view } from "@sidioralabs/rex/client";
import FeedbackRegion from "./regions/feedback/region.tsx";
import IntroRegion from "./regions/intro/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <IntroRegion />
    <FeedbackRegion />
  </Page.Stack>
));
