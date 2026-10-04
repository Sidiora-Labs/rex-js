import { region } from "@sidioralabs/rex/client";
import { Typography } from "../../../../components/ui/typography.tsx";

export default region("live-sidecar", () => (
  <Typography variant="h2" as="h2">
    This page's own sidecar
  </Typography>
));
