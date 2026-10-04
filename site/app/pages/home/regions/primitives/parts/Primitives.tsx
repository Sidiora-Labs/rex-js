import type { DECLARATION_KINDS } from "@sidioralabs/rex";
import { Page } from "@sidioralabs/rex/client";
import { Card, CardContent, CardHeader } from "../../../../../components/ui/card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

type DeclarationKind = (typeof DECLARATION_KINDS)[number];

export interface PrimitivesProps {
  readonly kinds: readonly DeclarationKind[];
}

const DECLARATIONS: Readonly<Record<DeclarationKind, string>> = {
  entity: "A typed record and its fields, kept by a store adapter bound in app/data.",
  action:
    "A server procedure with input, output, policy and effect, and the only way the interface changes anything.",
  page: "A route with its render mode, loaders, regions, overlays, states and chrome.",
  policy: "Named permissions and the predicates every action and page evaluates.",
  flow: "A sequence of action steps and approval gates whose progress is kept in a journal.",
};

export default function Primitives({ kinds }: PrimitivesProps) {
  return (
    <Page.Stack space={5}>
      <Typography variant="h2" as="h2">
        Declarations and the manifest
      </Typography>
      <Typography variant="lead">
        An app is <span data-site-fact="declaration-kinds">{kinds.length}</span> kinds of
        declaration. Everything else is derived from them, including the manifest an agent reads
        before it touches the interface.
      </Typography>
      <Page.Grid columns={3} space={4}>
        {kinds.map((kind) => (
          <Card key={kind} data-site-declaration={kind}>
            <CardHeader>
              <Typography variant="h4" as="h3">
                <code>{kind}()</code>
              </Typography>
            </CardHeader>
            <CardContent>
              <Typography variant="p" className="text-muted-foreground">
                {DECLARATIONS[kind]}
              </Typography>
            </CardContent>
          </Card>
        ))}
        <Card variant="tonal" data-site-declaration="manifest">
          <CardHeader>
            <Typography variant="h4" as="h3">
              The manifest
            </Typography>
          </CardHeader>
          <CardContent>
            <Typography variant="p" className="text-muted-foreground">
              <code>rex manifest</code> writes <code>.rex/manifest.json</code> and{" "}
              <code>AGENTS.md</code> from the declarations, and the app answers{" "}
              <code>/rex/manifest</code> with the same JSON.{" "}
              <a href="/docs/primitives" className="underline underline-offset-4">
                Primitives
              </a>{" "}
              describes every field.
            </Typography>
          </CardContent>
        </Card>
      </Page.Grid>
    </Page.Stack>
  );
}
