import { readFileSync } from "node:fs";
import path from "node:path";

export const REPOSITORY_ROOT = path.resolve(process.cwd(), "..");
export const CHANGELOG_SOURCE = "CHANGELOG.md";

export type LeafInline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "strong"; readonly text: string };

export type Inline =
  LeafInline | { readonly kind: "link"; readonly href: string; readonly children: LeafInline[] };

export type LeafBlock =
  | { readonly kind: "paragraph"; readonly inlines: Inline[] }
  | { readonly kind: "list"; readonly items: Inline[][] };

export type Block =
  | LeafBlock
  | {
      readonly kind: "details";
      readonly summary: Inline[];
      readonly blocks: LeafBlock[];
    };

export interface ChangelogSection {
  readonly title: string;
  readonly slug: string;
  readonly blocks: Block[];
}

export interface Release {
  readonly version: string;
  readonly slug: string;
  readonly blocks: Block[];
  readonly sections: ChangelogSection[];
}

export interface Changelog {
  readonly source: string;
  readonly title: string;
  readonly intro: Block[];
  readonly releases: Release[];
}

const CODE = /^`([^`]+)`/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/;
const STRONG = /^\*\*(.+?)\*\*/;
const SPECIAL = /[`[*]/;
const SUMMARY = /^<summary>(.*)<\/summary>$/;
const HEADING = /^(#+)\s+(.+)$/;

function leafInlines(text: string): LeafInline[] {
  const found: LeafInline[] = [];
  let rest = text;
  let plain = "";
  const flush = () => {
    if (plain !== "") found.push({ kind: "text", text: plain });
    plain = "";
  };
  while (rest !== "") {
    const code = CODE.exec(rest);
    const strong = code === null ? STRONG.exec(rest) : null;
    if (code !== null) {
      flush();
      found.push({ kind: "code", text: code[1] as string });
      rest = rest.slice(code[0].length);
    } else if (strong !== null) {
      flush();
      found.push({ kind: "strong", text: strong[1] as string });
      rest = rest.slice(strong[0].length);
    } else {
      const next = rest.slice(1).search(SPECIAL);
      const take = next === -1 ? rest.length : next + 1;
      plain += rest.slice(0, take);
      rest = rest.slice(take);
    }
  }
  flush();
  return found;
}

export function parseInline(text: string): Inline[] {
  const found: Inline[] = [];
  let rest = text;
  let plain = "";
  const flush = () => {
    if (plain !== "") found.push(...leafInlines(plain));
    plain = "";
  };
  while (rest !== "") {
    const code = CODE.exec(rest);
    const link = code === null ? LINK.exec(rest) : null;
    if (code !== null) {
      plain += code[0];
      rest = rest.slice(code[0].length);
    } else if (link !== null) {
      flush();
      found.push({
        kind: "link",
        href: link[2] as string,
        children: leafInlines(link[1] as string),
      });
      rest = rest.slice(link[0].length);
    } else {
      const next = rest.slice(1).search(/[`[]/);
      const take = next === -1 ? rest.length : next + 1;
      plain += rest.slice(0, take);
      rest = rest.slice(take);
    }
  }
  flush();
  return found;
}

export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

class BlockReader {
  private readonly blocks: Block[] = [];
  private paragraph: string[] = [];
  private list: string[] = [];
  private details: { summary: Inline[] | null; blocks: LeafBlock[] } | null = null;

  constructor(private readonly where: (line: number) => string) {}

  private push(block: LeafBlock): void {
    if (this.details !== null) this.details.blocks.push(block);
    else this.blocks.push(block);
  }

  private close(): void {
    if (this.paragraph.length > 0) {
      this.push({ kind: "paragraph", inlines: parseInline(this.paragraph.join(" ")) });
      this.paragraph = [];
    }
    if (this.list.length > 0) {
      this.push({ kind: "list", items: this.list.map((item) => parseInline(item)) });
      this.list = [];
    }
  }

  line(raw: string, number: number): void {
    const text = raw.trim();
    if (text === "") {
      this.close();
      return;
    }
    if (text.startsWith("<")) {
      this.close();
      this.html(text, number);
      return;
    }
    if (text.startsWith("```") || raw.startsWith("    ") || raw.startsWith("\t")) {
      throw new Error(`changelog: ${this.where(number)} uses a block the site does not render`);
    }
    if (text.startsWith("- ")) {
      if (this.paragraph.length > 0) this.close();
      this.list.push(text.slice(2).trim());
      return;
    }
    if (this.list.length > 0) this.close();
    this.paragraph.push(text);
  }

  private html(text: string, number: number): void {
    if (text === "<details>" && this.details === null) {
      this.details = { summary: null, blocks: [] };
      return;
    }
    const summary = SUMMARY.exec(text);
    if (summary !== null && this.details !== null && this.details.summary === null) {
      this.details.summary = parseInline((summary[1] as string).trim());
      return;
    }
    if (text === "</details>" && this.details !== null && this.details.summary !== null) {
      this.blocks.push({
        kind: "details",
        summary: this.details.summary,
        blocks: this.details.blocks,
      });
      this.details = null;
      return;
    }
    throw new Error(`changelog: ${this.where(number)} has HTML the site does not render: ${text}`);
  }

  finish(number: number): Block[] {
    this.close();
    if (this.details !== null) {
      throw new Error(`changelog: ${this.where(number)} ends inside an open <details>`);
    }
    return this.blocks;
  }
}

interface OpenRelease {
  readonly version: string;
  readonly blocks: BlockReader;
  readonly sections: { title: string; reader: BlockReader }[];
}

export function parseChangelog(text: string, source: string = CHANGELOG_SOURCE): Changelog {
  const where = (line: number) => `${source}:${line}`;
  let title: string | null = null;
  const intro = new BlockReader(where);
  const releases: OpenRelease[] = [];
  const lines = text.split(/\r?\n/);
  const current = (): BlockReader => {
    const release = releases.at(-1);
    if (release === undefined) return intro;
    return release.sections.at(-1)?.reader ?? release.blocks;
  };
  const finishCurrent = (line: number) => {
    current().finish(line);
  };
  lines.forEach((raw, index) => {
    const number = index + 1;
    const heading = HEADING.exec(raw.trim());
    if (heading === null) {
      current().line(raw, number);
      return;
    }
    const level = (heading[1] as string).length;
    const name = (heading[2] as string).trim();
    if (level === 1 && title === null && releases.length === 0) {
      title = name;
      return;
    }
    if (level === 2) {
      finishCurrent(number);
      releases.push({ version: name, blocks: new BlockReader(where), sections: [] });
      return;
    }
    const release = releases.at(-1);
    if (level === 3 && release !== undefined) {
      finishCurrent(number);
      release.sections.push({ title: name, reader: new BlockReader(where) });
      return;
    }
    throw new Error(`changelog: ${where(number)} has a level ${level} heading out of place`);
  });
  const end = lines.length;
  if (title === null) throw new Error(`changelog: ${source} has no # title`);
  if (releases.length === 0) throw new Error(`changelog: ${source} has no ## release`);
  return {
    source,
    title,
    intro: intro.finish(end),
    releases: releases.map((release) => ({
      version: release.version,
      slug: slugOf(`release ${release.version}`),
      blocks: release.blocks.finish(end),
      sections: release.sections.map((section) => ({
        title: section.title,
        slug: slugOf(`${release.version} ${section.title}`),
        blocks: section.reader.finish(end),
      })),
    })),
  };
}

export function readChangelog(root: string = REPOSITORY_ROOT): Changelog {
  return parseChangelog(readFileSync(path.join(root, CHANGELOG_SOURCE), "utf8"));
}
