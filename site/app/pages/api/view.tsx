import { Page, view } from "@sidioralabs/rex/client";
import EntriesRegion from "./regions/entries/region.tsx";
import SearchRegion from "./regions/search/region.tsx";

export default view(() => (
  <Page.Stack space={7}>
    <SearchRegion />
    <EntriesRegion />
  </Page.Stack>
));
