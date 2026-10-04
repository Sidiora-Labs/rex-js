import { searchEntries as docEntries } from "./docs.ts";
import { errorSearchEntries } from "./errors.ts";

export interface SearchEntry {
  readonly section: string;
  readonly title: string;
  readonly route: string;
  readonly headings: readonly string[];
  readonly summary: string;
}

export type SearchSource = () => Promise<readonly SearchEntry[]>;

export const ERROR_SECTION = "Errors";

async function errorEntries(): Promise<readonly SearchEntry[]> {
  return errorSearchEntries().map((entry) => ({ section: ERROR_SECTION, ...entry }));
}

export const SEARCH_SOURCES: readonly SearchSource[] = [docEntries, errorEntries];

export async function buildSearchIndex(): Promise<readonly SearchEntry[]> {
  const lists = await Promise.all(SEARCH_SOURCES.map((source) => source()));
  const seen = new Set<string>();
  const entries: SearchEntry[] = [];
  for (const entry of lists.flat()) {
    if (seen.has(entry.route)) {
      throw new Error(`rex-site: the search index lists ${entry.route} twice`);
    }
    seen.add(entry.route);
    entries.push(entry);
  }
  return entries;
}
