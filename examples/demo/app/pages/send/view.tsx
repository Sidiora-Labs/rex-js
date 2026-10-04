import { Page, view } from "@sidioralabs/rex/client";
import ConfirmRegion from "./regions/confirm/region.tsx";
import FormRegion from "./regions/form/region.tsx";
import SuccessRegion from "./regions/success/region.tsx";

export default view(() => (
  <Page.Stack space={4}>
    <FormRegion />
    <ConfirmRegion />
    <SuccessRegion />
  </Page.Stack>
));
