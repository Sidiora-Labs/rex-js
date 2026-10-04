import { Page, view } from "@sidioralabs/rex/client";
import TableRegion from "./regions/table/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <TableRegion />
  </Page.Stack>
));
