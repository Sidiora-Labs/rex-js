import { Typography } from "./ui/typography.tsx";

export const TOC_MAX_DEPTH = 3;

export interface TocHeading {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

export interface TocProps {
  readonly headings: readonly TocHeading[];
  readonly title?: string;
}

export default function Toc({ headings, title = "On this page" }: TocProps) {
  const listed = headings.filter((heading) => heading.depth <= TOC_MAX_DEPTH);
  if (listed.length === 0) return null;
  return (
    <nav aria-label={title} data-site-toc="">
      <Typography variant="eyebrow" as="h2" className="m-0">
        {title}
      </Typography>
      <ol className="m-0 mt-3 flex list-none flex-col gap-0.5 p-0">
        {listed.map((heading) => (
          <li key={heading.id} data-depth={heading.depth} className="data-[depth=3]:pl-4">
            <a
              href={`#${heading.id}`}
              className="focus-ring flex min-h-8 items-center rounded-sm text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
