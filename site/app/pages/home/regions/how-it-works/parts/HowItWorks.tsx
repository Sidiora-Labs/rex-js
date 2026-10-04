import type { InvocationRoute } from "@sidioralabs/rex";
import { Page } from "@sidioralabs/rex/client";
import { Separator } from "../../../../../components/ui/separator.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";
import AttributeTable from "./AttributeTable.tsx";
import InvocationRoutes from "./InvocationRoutes.tsx";

export interface HowItWorksProps {
  readonly routes: readonly InvocationRoute[];
}

export default function HowItWorks({ routes }: HowItWorksProps) {
  return (
    <Page.Stack space={5}>
      <Typography variant="h2" as="h2">
        How an agent operates a Rex page
      </Typography>
      <Typography variant="lead">
        There is no separate agent view. An agent reads the sidecar to learn what the page offers,
        finds each control by its address, and invokes it through the same routes a person uses. The
        addresses come from the declaration names, so they are identical across builds and never
        depend on markup or styles.
      </Typography>
      <AttributeTable />
      <Separator />
      <InvocationRoutes routes={routes} />
    </Page.Stack>
  );
}
