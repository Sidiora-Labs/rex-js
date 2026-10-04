import { Page } from "@sidioralabs/rex/client";
import CardRegion from "./regions/card/region.tsx";

export default function ProfileView() {
  return (
    <Page.Stack space={4}>
      <CardRegion />
    </Page.Stack>
  );
}
