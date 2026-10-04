import { Page, view } from "@sidioralabs/rex/client";
import IndexRegion from "./regions/index/region.tsx";
import SearchRegion from "./regions/search/region.tsx";

export default view(() => (
  <Page.Stack space={7}>
    <SearchRegion />
    <IndexRegion />
  </Page.Stack>
));
