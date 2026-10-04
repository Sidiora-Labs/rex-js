import { Typography } from "../../../../../components/ui/typography.tsx";

export interface StandardsSummaryProps {
  readonly met: number;
  readonly total: number;
  readonly source: string;
  readonly sourceHref: string;
}

export default function StandardsSummary({
  met,
  total,
  source,
  sourceHref,
}: StandardsSummaryProps) {
  return (
    <div className="flex flex-col gap-2">
      <Typography variant="h3" as="h2">
        The framework standards Rex 0.2 is held to
      </Typography>
      <Typography variant="lead" data-site-standards-count={`${met}/${total}`}>
        {met} of {total} standards met
      </Typography>
      <Typography variant="muted">
        A standard is met when every task that owns it is done, and partial while an owning task is
        still open. Read from{" "}
        <a href={sourceHref} rel="noopener" className="underline underline-offset-4">
          <code>{source}</code>
        </a>{" "}
        at build time.
      </Typography>
    </div>
  );
}
