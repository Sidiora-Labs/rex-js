import { Img } from "@sidioralabs/rex/client/media";
import Card from "../../../../../components/Card.tsx";

export interface AboutIntroProps {
  readonly heading: string;
}

export default function AboutIntro({ heading }: AboutIntroProps) {
  return (
    <Card title={heading}>
      <Img src="/images/rex-mark.svg" alt="Rex mark" width={64} height={64} priority />
      <p>
        This page is rendered once at build time and ships no page JavaScript. Every action on it is
        a plain HTML form that works through the form route.
      </p>
      <p>
        The wallet pages stream from the server, the token prices are prerendered and regenerated
        every minute, and the embed page shows a part running as a web component.
      </p>
    </Card>
  );
}
