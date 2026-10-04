import { Page, view } from "@sidioralabs/rex/client";
import ContributingRegion from "./regions/contributing/region.tsx";
import GovernanceRegion from "./regions/governance/region.tsx";
import LicenseRegion from "./regions/license/region.tsx";
import SecurityRegion from "./regions/security/region.tsx";
import SidioraRegion from "./regions/sidiora/region.tsx";

export default view(() => (
  <Page.Stack space={6}>
    <SidioraRegion />
    <LicenseRegion />
    <GovernanceRegion />
    <ContributingRegion />
    <SecurityRegion />
  </Page.Stack>
));
