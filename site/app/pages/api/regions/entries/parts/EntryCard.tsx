import { Badge } from "../../../../../components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../components/ui/card.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface EntrySymbol {
  readonly name: string;
  readonly id: string;
}

export interface EntryKind {
  readonly title: string;
  readonly id: string;
  readonly symbols: readonly EntrySymbol[];
}

export interface EntryCardProps {
  readonly slug: string;
  readonly title: string;
  readonly entry: string;
  readonly summary: string;
  readonly href: string;
  readonly kinds: readonly EntryKind[];
}

export default function EntryCard({ slug, title, entry, summary, href, kinds }: EntryCardProps) {
  const headingId = `api-entry-${slug}`;
  return (
    <Card data-site-api-entry={entry}>
      <section aria-labelledby={headingId} className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <Typography variant="h4" as="h3" id={headingId} className="m-0 min-w-0 break-words">
              <a
                href={href}
                data-site-api-link={slug}
                className="focus-ring inline-flex min-h-9 items-center rounded-sm font-mono text-foreground underline-offset-4 hover:underline pointer-coarse:min-h-11"
              >
                {title}
              </a>
            </Typography>
            <Badge variant="tonal" className="font-mono">
              {entry}
            </Badge>
          </CardTitle>
          <CardDescription>{summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {kinds.map((kind) => (
            <div key={kind.id} data-site-api-kind={kind.title} className="flex flex-col gap-2">
              <Typography variant="eyebrow" as="h4" className="m-0">
                {kind.title} ({kind.symbols.length})
              </Typography>
              <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
                {kind.symbols.map((symbol) => (
                  <li key={symbol.id} className="min-w-0">
                    <a
                      href={`${href}#${symbol.id}`}
                      data-site-api-symbol={symbol.name}
                      className="focus-ring inline-flex min-h-8 items-center rounded-sm font-mono text-sm break-all text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
                    >
                      {symbol.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </section>
    </Card>
  );
}
