import { Page } from "@sidioralabs/rex/client";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "../../../../../components/ui/card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface RulesProps {
  readonly checkerRules: number;
}

interface Rule {
  readonly id: string;
  readonly title: string;
  readonly body: ReactNode;
}

function rules(checkerRules: number): readonly Rule[] {
  return [
    {
      id: "declaration",
      title: "One declaration per capability",
      body: (
        <>
          Entities, actions, pages, policies and flows are each declared once with{" "}
          <code>entity()</code>, <code>action()</code>, <code>page()</code>, <code>policy()</code>{" "}
          and <code>flow()</code>. The server procedures, client hooks, routes, palette entries,
          sidecar entries and the manifest are derived from those declarations.
        </>
      ),
    },
    {
      id: "folder",
      title: "One folder convention per page",
      body: (
        <>
          Every page lives in <code>app/pages/&lt;page&gt;/</code> with fixed file names:{" "}
          <code>page.ts</code>, <code>view.tsx</code>, <code>states.tsx</code>, <code>hooks/</code>,{" "}
          <code>regions/</code>, <code>overlays/</code> and <code>test/</code>.
        </>
      ),
    },
    {
      id: "checker",
      title: "One checker",
      body: (
        <>
          <code>rex check</code> runs <span data-site-fact="checker-rules">{checkerRules}</span>{" "}
          rules, the typecheck among them, and fails on any error finding. <code>rex dev</code> and{" "}
          <code>rex build</code> run it first.
        </>
      ),
    },
    {
      id: "dom",
      title: "One DOM that humans and agents operate",
      body: (
        <>
          Every action control carries a <code>data-rex</code> address, every page embeds a
          machine-readable sidecar, and every action is reachable by click, keyboard shortcut, URL
          and command palette.
        </>
      ),
    },
  ];
}

export default function Rules({ checkerRules }: RulesProps) {
  return (
    <Page.Stack space={5}>
      <Typography variant="h2" as="h2">
        One way to build it, one DOM to operate it
      </Typography>
      <Typography variant="lead">
        Rex removes the decisions an agent would otherwise make differently on every screen. It is
        built around these rules.
      </Typography>
      <Page.Grid columns={2} space={4}>
        {rules(checkerRules).map((rule) => (
          <Card key={rule.id} data-site-rule={rule.id}>
            <CardHeader>
              <Typography variant="h4" as="h3">
                {rule.title}
              </Typography>
            </CardHeader>
            <CardContent>
              <Typography variant="p" className="text-muted-foreground">
                {rule.body}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Page.Grid>
    </Page.Stack>
  );
}
