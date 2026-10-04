import { Page } from "@sidioralabs/rex/client";
import FormRegion from "./regions/form/region.tsx";

export default function SendView() {
  return (
    <Page.Stack space={4}>
      <FormRegion />
    </Page.Stack>
  );
}
