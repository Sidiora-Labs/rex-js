import { Page, view } from "@sidioralabs/rex/client";
import ActionsRegion from "./regions/actions/region.tsx";
import HeroRegion from "./regions/hero/region.tsx";
import HoldingsRegion from "./regions/holdings/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <HeroRegion />
    <ActionsRegion />
    <HoldingsRegion />
  </Page.Stack>
));
