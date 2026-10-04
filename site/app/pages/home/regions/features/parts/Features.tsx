import { Page } from "@sidioralabs/rex/client";
import type { ReactNode } from "react";
import { Badge } from "../../../../../components/ui/badge.tsx";
import { Card, CardContent, CardFooter, CardHeader } from "../../../../../components/ui/card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface FeaturesProps {
  readonly errorCodes: number;
  readonly dataStates: number;
  readonly clientBudgetKb: number;
}

interface Feature {
  readonly id: string;
  readonly title: ReactNode;
  readonly body: ReactNode;
  readonly href: string;
  readonly doc: string;
}

function features({ errorCodes, dataStates, clientBudgetKb }: FeaturesProps): readonly Feature[] {
  return [
    {
      id: "rendering",
      title: "Rendering modes",
      body: (
        <>
          Each page renders <code>ssr</code>, <code>csr</code>, <code>ssg</code> or{" "}
          <code>static</code>. A static page ships no page JavaScript at all.
        </>
      ),
      href: "/docs/recipes/static-page",
      doc: "Ship a static page",
    },
    {
      id: "no-js",
      title: "Loaders and forms without JavaScript",
      body: (
        <>
          Loaders are read actions run on the server or at build time, and <code>ActionForm</code>{" "}
          posts an action as a plain form.
        </>
      ),
      href: "/docs/recipes/form-without-js",
      doc: "A form that works without JavaScript",
    },
    {
      id: "targets",
      title: "Node, Bun, Deno and the edge",
      body: (
        <>
          <code>rex build --target</code> emits the server for <code>node</code>, <code>bun</code>,{" "}
          <code>deno</code> or <code>edge</code>, or a complete static deployment.
        </>
      ),
      href: "/docs/platforms",
      doc: "Platforms and build targets",
    },
    {
      id: "states",
      title: (
        <>
          The <span data-site-fact="data-states">{dataStates}</span> data states
        </>
      ),
      body: (
        <>
          Every page is in exactly one data state, and <code>states.tsx</code> renders each one that
          is not ready.
        </>
      ),
      href: "/docs/primitives",
      doc: "Primitives",
    },
    {
      id: "designx",
      title: "The DesignX standard",
      body: (
        <>
          <code>rex new</code> installs the DesignX set into <code>app/components/ui</code>, and{" "}
          <code>rex check</code> holds regions, parts and overlays to it.
        </>
      ),
      href: "/docs/recipes/designx",
      doc: "Build on the DesignX standard",
    },
    {
      id: "screen-fit",
      title: "Screen-fit",
      body: (
        <>
          Phone, tablet and desktop, coarse and fine pointers and density: navigation, overlays and
          lists change form with the screen.
        </>
      ),
      href: "/docs/convention",
      doc: "The Rex convention",
    },
    {
      id: "errors",
      title: "Errors with REX codes",
      body: (
        <>
          <span data-site-fact="error-codes">{errorCodes}</span> codes, each thrown with a hint and
          a docs link to its own page on this site.
        </>
      ),
      href: "/docs/errors",
      doc: "Rex error codes",
    },
    {
      id: "testing",
      title: "rex/testing",
      body: (
        <>
          <code>createTestApp</code>, <code>renderPage</code> and <code>readSidecar</code> test
          pages against the real registry and server in happy-dom.
        </>
      ),
      href: "/docs/tutorial",
      doc: "Tutorial: build the wallet",
    },
    {
      id: "i18n",
      title: "i18n",
      body: (
        <>
          <code>msg:</code> keys, locale routing and formatters, held to the message catalog by{" "}
          <code>rex check</code> once an app configures it.
        </>
      ),
      href: "/docs/recipes/i18n",
      doc: "Translate an app",
    },
    {
      id: "security",
      title: "Security defaults",
      body: (
        <>
          A CSP nonce on every inline script, Origin checks on every write and a CSRF double-submit
          cookie on every form post.
        </>
      ),
      href: "/docs/architecture",
      doc: "Architecture",
    },
    {
      id: "telemetry",
      title: "OpenTelemetry spans",
      body: (
        <>
          With a tracer in <code>rex.config.ts</code>, every action call, form post, loader run and
          page render records a span.
        </>
      ),
      href: "/docs/architecture",
      doc: "Architecture",
    },
    {
      id: "budgets",
      title: "Budgets enforced by rex build",
      body: (
        <>
          A client chunk may weigh <span data-site-fact="client-budget">{clientBudgetKb}</span> KB
          gzipped by default, and <code>rex build</code> fails on a chunk over its budget.
        </>
      ),
      href: "/docs/cli",
      doc: "The rex CLI",
    },
    {
      id: "codemods",
      title: "Codemods with rex migrate",
      body: (
        <>
          <code>rex migrate</code> lists and applies the codemods that move an app from an earlier
          Rex version.
        </>
      ),
      href: "/docs/migration",
      doc: "Migration guide",
    },
  ];
}

export default function Features(props: FeaturesProps) {
  return (
    <Page.Stack space={5}>
      <Typography variant="h2" as="h2">
        Features
      </Typography>
      <Typography variant="lead">
        Each feature links the page that documents it, read from the repository when this site is
        built.
      </Typography>
      <Page.Grid columns={3} space={4}>
        {features(props).map((feature) => (
          <Card key={feature.id} data-site-feature={feature.id}>
            <CardHeader>
              <Typography variant="h4" as="h3">
                {feature.title}
              </Typography>
            </CardHeader>
            <CardContent className="flex-1">
              <Typography variant="p" className="text-muted-foreground">
                {feature.body}
              </Typography>
            </CardContent>
            <CardFooter>
              <a
                href={feature.href}
                data-site-doc={feature.doc}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium underline underline-offset-4"
              >
                <Badge variant="outline">Docs</Badge>
                {feature.doc}
              </a>
            </CardFooter>
          </Card>
        ))}
      </Page.Grid>
    </Page.Stack>
  );
}
