import { Badge } from "../../../../../components/ui/badge.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface AreaSectionEntry {
  readonly code: string;
  readonly message: string;
  readonly hint: string;
  readonly href: string;
}

export interface AreaSectionProps {
  readonly prefix: string;
  readonly title: string;
  readonly doc: { readonly title: string; readonly href: string };
  readonly entries: readonly AreaSectionEntry[];
}

export default function AreaSection({ prefix, title, doc, entries }: AreaSectionProps) {
  const headingId = `errors-area-${prefix}`;
  return (
    <section
      aria-labelledby={headingId}
      data-site-error-area={prefix}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Typography variant="h3" as="h2" id={headingId}>
          {prefix}xx {title}
        </Typography>
        <Badge variant="tonal">{entries.length}</Badge>
        <a
          href={doc.href}
          className="focus-ring inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {doc.title}
        </a>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {entries.map((entry) => (
          <li
            key={entry.code}
            data-site-error-code={entry.code}
            className="flex flex-col gap-1 py-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <a
                href={entry.href}
                className="focus-ring inline-flex min-h-11 items-center rounded-sm font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {entry.code}
              </a>
              <span className="text-sm">{entry.message}</span>
            </div>
            <Typography variant="muted">{entry.hint}</Typography>
          </li>
        ))}
      </ul>
    </section>
  );
}
