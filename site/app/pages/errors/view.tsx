import { Page, view } from "@sidioralabs/rex/client";
import CatalogRegion from "./regions/catalog/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <CatalogRegion />
  </Page.Stack>
));
