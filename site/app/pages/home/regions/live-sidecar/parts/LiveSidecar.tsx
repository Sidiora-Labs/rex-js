import { Page } from "@sidioralabs/rex/client";
import CodeBlock from "../../../../../components/CodeBlock.tsx";
import { Button } from "../../../../../components/ui/button.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface LiveSidecarProps {
  readonly json: string;
  readonly copyAddress: string;
  readonly onCopy: () => void;
}

export default function LiveSidecar({ json, copyAddress, onCopy }: LiveSidecarProps) {
  return (
    <Page.Stack space={4}>
      <Typography variant="h2" as="h2">
        This page&apos;s own sidecar
      </Typography>
      <Typography variant="lead">
        Every Rex page carries the JSON an agent reads before it acts. This is the sidecar of the
        page you are reading, rendered from the same registry as the script that carries it, so it
        changes when the page does.
      </Typography>
      <div>
        <Button
          type="button"
          variant="tonal"
          className="pointer-coarse:min-h-11"
          data-rex={copyAddress}
          data-rex-allowed="true"
          onClick={onCopy}
        >
          Copy addresses
        </Button>
      </div>
      <div data-site-live-sidecar="">
        <CodeBlock
          language="json"
          code={json}
          caption={
            <>
              The element <code>main[data-rex-page=&quot;home&quot;]</code> holds this page, and{" "}
              <code>script#rex-page</code> of type <code>application/rex+json</code> carries this
              JSON. Copy addresses puts the page, region and action addresses on your clipboard.
            </>
          }
        />
      </div>
    </Page.Stack>
  );
}
