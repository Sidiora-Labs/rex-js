import { Page, view } from "../../../client/index.ts";
import ComposerRegion from "./regions/composer/region.tsx";
import ListRegion from "./regions/list/region.tsx";

export default view(() => (
  <Page.Stack>
    <ListRegion />
    <ComposerRegion />
  </Page.Stack>
));
