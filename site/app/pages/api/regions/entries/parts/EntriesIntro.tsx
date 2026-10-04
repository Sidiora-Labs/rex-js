import { Typography } from "../../../../../components/ui/typography.tsx";

export interface EntriesIntroProps {
  readonly packageName: string;
  readonly version: string;
  readonly count: number;
}

export default function EntriesIntro({ packageName, version, count }: EntriesIntroProps) {
  return (
    <div className="flex flex-col gap-2">
      <Typography variant="h3" as="h2" className="m-0">
        Package entries
      </Typography>
      <Typography variant="muted" className="m-0" data-site-api-intro="">
        {packageName} {version} publishes {count} entries. Each lists its exports by kind and links
        to its reference page.
      </Typography>
    </div>
  );
}
