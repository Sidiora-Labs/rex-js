import { view } from "@sidioralabs/rex/client";
import ConfirmRegion from "./regions/confirm/region.tsx";
import FormRegion from "./regions/form/region.tsx";
import SuccessRegion from "./regions/success/region.tsx";

export default view(() => (
  <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
    <FormRegion />
    <div data-demo-sticky="" className="flex flex-col gap-6 lg:sticky lg:top-20">
      <ConfirmRegion />
      <SuccessRegion />
    </div>
  </div>
));
