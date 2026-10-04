import { Img } from "@sidioralabs/rex/client";
import Card from "../../../../../components/Card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface AboutIntroProps {
  readonly heading: string;
}

export default function AboutIntro({ heading }: AboutIntroProps) {
  return (
    <Card variant="tonal">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Img
          src="/images/rex-mark.svg"
          alt="Rex mark"
          width={64}
          height={64}
          priority
          className="shrink-0 rounded-xl"
        />
        <div className="flex flex-col gap-3">
          <Typography variant="eyebrow">About this demo</Typography>
          <Typography variant="h3" as="h2">
            {heading}
          </Typography>
          <Typography variant="lead">
            This page is rendered once at build time and ships no page JavaScript. Every action on
            it is a plain HTML form that works through the form route.
          </Typography>
          <Typography variant="muted">
            The wallet pages stream from the server, the token prices are prerendered and
            regenerated every minute, and the embed page shows a part running as a web component.
          </Typography>
        </div>
      </div>
    </Card>
  );
}
