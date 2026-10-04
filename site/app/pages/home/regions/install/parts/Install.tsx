import { Page } from "@sidioralabs/rex/client";
import InstallBlock from "../../../../../components/InstallBlock.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface InstallProps {
  readonly version: string;
}

export default function Install({ version }: InstallProps) {
  return (
    <Page.Stack space={4}>
      <Typography variant="h2" as="h2">
        Install
      </Typography>
      <Typography variant="lead">
        Write a complete app with one command, then serve it. The{" "}
        <a href="/docs/tutorial" className="underline underline-offset-4">
          tutorial
        </a>{" "}
        builds a wallet on it page by page.
      </Typography>
      <InstallBlock version={version} />
    </Page.Stack>
  );
}
