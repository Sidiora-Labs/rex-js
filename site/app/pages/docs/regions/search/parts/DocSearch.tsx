import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../../components/ui/command.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

interface DocSearchEntry {
  readonly section: string;
  readonly title: string;
  readonly route: string;
  readonly headings: readonly string[];
  readonly summary: string;
}

interface DocSearchProps {
  readonly entries: readonly DocSearchEntry[];
  readonly onOpen: (route: string) => void;
}

const SEARCH_LABEL = "Search the docs";

function sections(entries: readonly DocSearchEntry[]): readonly [string, DocSearchEntry[]][] {
  const grouped = new Map<string, DocSearchEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.section);
    if (list === undefined) grouped.set(entry.section, [entry]);
    else list.push(entry);
  }
  return [...grouped.entries()];
}

export default function DocSearch({ entries, onOpen }: DocSearchProps) {
  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h3" as="h2" className="m-0">
        {SEARCH_LABEL}
      </Typography>
      <Command
        label={SEARCH_LABEL}
        data-site-search=""
        className="rounded-xl border border-outline-variant"
      >
        <CommandInput placeholder="Search guides, recipes and their headings" />
        <CommandList className="max-h-96">
          <CommandEmpty>No page matches the search.</CommandEmpty>
          {sections(entries).map(([section, items]) => (
            <CommandGroup key={section} heading={section}>
              {items.map((entry) => (
                <CommandItem
                  key={entry.route}
                  value={entry.route}
                  keywords={[entry.title, entry.section, ...entry.headings]}
                  onSelect={() => onOpen(entry.route)}
                  data-site-search-result={entry.route}
                  className="h-auto py-2 pointer-coarse:min-h-11"
                >
                  <span className="flex w-full min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-foreground">{entry.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{entry.summary}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
