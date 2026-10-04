import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../../../components/ui/command.tsx";
import { Typography } from "../../../../../components/ui/typography.tsx";

export interface ApiSearchEntry {
  readonly slug: string;
  readonly title: string;
  readonly route: string;
  readonly headings: readonly string[];
  readonly summary: string;
}

export interface ApiSearchProps {
  readonly entries: readonly ApiSearchEntry[];
  readonly onOpen: (slug: string) => void;
}

const SEARCH_LABEL = "Search the API";

export default function ApiSearch({ entries, onOpen }: ApiSearchProps) {
  return (
    <div className="flex flex-col gap-4">
      <Typography variant="h3" as="h2" className="m-0">
        {SEARCH_LABEL}
      </Typography>
      <Command
        label={SEARCH_LABEL}
        data-site-api-search=""
        className="rounded-xl border border-outline-variant"
      >
        <CommandInput placeholder="Search the package entries and their exports" />
        <CommandList className="max-h-96">
          <CommandEmpty>No entry matches the search.</CommandEmpty>
          <CommandGroup heading="Entries">
            {entries.map((entry) => (
              <CommandItem
                key={entry.route}
                value={entry.route}
                keywords={[entry.title, ...entry.headings]}
                onSelect={() => onOpen(entry.slug)}
                data-site-api-search-result={entry.route}
                className="h-auto py-2 pointer-coarse:min-h-11"
              >
                <span className="flex w-full min-w-0 flex-col gap-0.5">
                  <span className="font-mono font-medium text-foreground">{entry.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{entry.summary}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
