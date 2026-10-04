import { Page, view } from "@sidioralabs/rex/client";
import FeaturesRegion from "./regions/features/region.tsx";
import FooterRegion from "./regions/footer/region.tsx";
import HeroRegion from "./regions/hero/region.tsx";
import HowItWorksRegion from "./regions/how-it-works/region.tsx";
import InstallRegion from "./regions/install/region.tsx";
import LiveSidecarRegion from "./regions/live-sidecar/region.tsx";
import PitchRegion from "./regions/pitch/region.tsx";
import PrimitivesRegion from "./regions/primitives/region.tsx";

export default view(() => (
  <Page.Stack space={8}>
    <HeroRegion />
    <PitchRegion />
    <PrimitivesRegion />
    <HowItWorksRegion />
    <InstallRegion />
    <FeaturesRegion />
    <LiveSidecarRegion />
    <FooterRegion />
  </Page.Stack>
));
