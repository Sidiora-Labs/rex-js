import { Page } from "@sidioralabs/rex/client";
import Mark from "../../../../../components/Mark.tsx";
import { REPOSITORY_URL } from "../../../../../components/Shell.tsx";
import { Badge } from "../../../../../components/ui/badge.tsx";
import { buttonVariants } from "../../../../../components/ui/button.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface HeroProps {
  readonly version: string;
}

export default function Hero({ version }: HeroProps) {
  return (
    <Page.Stack space={5}>
      <Mark className="h-16 w-auto sm:h-20" priority />
      <Badge variant="tonal">
        Version <span data-site-fact="version">{version}</span>
      </Badge>
      <Typography variant="display" as="h1">
        The UI framework agents can operate
      </Typography>
      <Typography variant="lead">
        Rex is Sidiora Labs&apos; TypeScript framework for React application interfaces that AI
        agents write and AI agents operate, on a phone, a tablet or a desk.
      </Typography>
      <div className="flex flex-wrap gap-3">
        <a
          href="/docs/tutorial"
          data-site-cta="tutorial"
          className={`${buttonVariants({ variant: "default" })} pointer-coarse:min-h-11`}
        >
          Start the tutorial
        </a>
        <a
          href="/docs"
          data-site-cta="docs"
          className={`${buttonVariants({ variant: "outline" })} pointer-coarse:min-h-11`}
        >
          Read the docs
        </a>
        <a
          href={REPOSITORY_URL}
          rel="noopener"
          data-site-cta="github"
          className={`${buttonVariants({ variant: "ghost" })} pointer-coarse:min-h-11`}
        >
          Rex on GitHub
        </a>
      </div>
    </Page.Stack>
  );
}
