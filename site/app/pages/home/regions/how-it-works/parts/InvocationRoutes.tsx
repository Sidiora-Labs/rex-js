import type { InvocationRoute } from "@sidioralabs/rex";
import { Page } from "@sidioralabs/rex/client";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "../../../../../components/ui/card.tsx";
import { Kbd, KbdGroup } from "../../../../../components/ui/kbd.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface InvocationRoutesProps {
  readonly routes: readonly InvocationRoute[];
}

const ROUTES: Readonly<
  Record<InvocationRoute, { readonly title: string; readonly body: ReactNode }>
> = {
  click: {
    title: "Click",
    body: (
      <>
        Press the control that carries the action&apos;s <code>data-rex</code> address, as a person
        would.
      </>
    ),
  },
  key: {
    title: "Keyboard shortcut",
    body: <>The shortcut the action declares, active while its page is the active page.</>,
  },
  palette: {
    title: "Command palette",
    body: (
      <>
        Open it with{" "}
        <KbdGroup>
          <Kbd>Mod</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>{" "}
        and pick any page or action by its label or id.
      </>
    ),
  },
  url: {
    title: "URL",
    body: (
      <>
        Add <code>?act=&lt;action&gt;</code> to the page URL, with <code>input</code> for its
        values.
      </>
    ),
  },
};

export default function InvocationRoutes({ routes }: InvocationRoutesProps) {
  return (
    <Page.Stack space={4}>
      <Typography variant="h3" as="h3">
        <span data-site-fact="invocation-routes">{routes.length}</span> routes to every action
      </Typography>
      <Page.Grid columns={2} space={4}>
        {routes.map((route) => (
          <Card key={route} data-site-route={route}>
            <CardHeader>
              <Typography variant="h4" as="h4">
                {ROUTES[route].title}
              </Typography>
            </CardHeader>
            <CardContent>
              <Typography variant="p" className="text-muted-foreground">
                {ROUTES[route].body}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Page.Grid>
    </Page.Stack>
  );
}
