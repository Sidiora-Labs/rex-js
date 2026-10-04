import { Page, view } from "@sidioralabs/rex/client";
import PricesRegion from "./regions/prices/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <PricesRegion />
  </Page.Stack>
));
