import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHANGELOG_SOURCE,
  parseChangelog,
  parseInline,
  readChangelog,
  type Block,
  type Inline,
} from "./changelog.ts";

const ROOT = path.resolve(process.cwd(), "..");
const TEXT = readFileSync(path.join(ROOT, CHANGELOG_SOURCE), "utf8");
const LINES = TEXT.split("\n");

function headings(level: number): string[] {
  const marker = `${"#".repeat(level)} `;
  return LINES.filter((line) => line.startsWith(marker)).map((line) =>
    line.slice(marker.length).trim(),
  );
}

function listItems(blocks: readonly Block[]): number {
  return blocks.reduce((count, block) => {
    if (block.kind === "list") return count + block.items.length;
    if (block.kind === "details") return count + listItems(block.blocks);
    return count;
  }, 0);
}

function links(inlines: readonly Inline[]): string[] {
  return inlines.flatMap((inline) => (inline.kind === "link" ? [inline.href] : []));
}

function blockLinks(blocks: readonly Block[]): string[] {
  return blocks.flatMap((block) => {
    if (block.kind === "paragraph") return links(block.inlines);
    if (block.kind === "list") return block.items.flatMap(links);
    return [...links(block.summary), ...blockLinks(block.blocks)];
  });
}

describe("changelog reader", () => {
  it("reads the title and splits CHANGELOG.md into one release per ## heading", () => {
    const changelog = readChangelog();
    expect(changelog.source).toBe(CHANGELOG_SOURCE);
    expect(changelog.title).toBe(headings(1)[0]);
    expect(headings(2).length).toBeGreaterThan(0);
    expect(changelog.releases.map((release) => release.version)).toEqual(headings(2));
  });

  it("keeps every ### group of every release in order", () => {
    const changelog = readChangelog();
    expect(
      changelog.releases.flatMap((release) => release.sections.map((section) => section.title)),
    ).toEqual(headings(3));
  });

  it("keeps every list item of the file, the commit log included", () => {
    const changelog = readChangelog();
    const parsed =
      listItems(changelog.intro) +
      changelog.releases.reduce(
        (count, release) =>
          count +
          listItems(release.blocks) +
          release.sections.reduce((inner, section) => inner + listItems(section.blocks), 0),
        0,
      );
    expect(parsed).toBe(LINES.filter((line) => line.startsWith("- ")).length);
  });

  it("keeps every link of the file as an absolute URL", () => {
    const changelog = readChangelog();
    const found = [
      ...blockLinks(changelog.intro),
      ...changelog.releases.flatMap((release) => [
        ...blockLinks(release.blocks),
        ...release.sections.flatMap((section) => blockLinks(section.blocks)),
      ]),
    ];
    expect(found.length).toBe((TEXT.match(/\]\(https:\/\/[^)\s]+\)/g) ?? []).length);
    for (const href of found) expect(href).toMatch(/^https:\/\//);
  });

  it("gives every release and group a unique anchor", () => {
    const changelog = readChangelog();
    const anchors = changelog.releases.flatMap((release) => [
      release.slug,
      ...release.sections.map((section) => section.slug),
    ]);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("parses code spans, links with code labels and strong text", () => {
    expect(parseInline("Run `rex check` on [`11c79cb`](https://example.com/c) **now**.")).toEqual([
      { kind: "text", text: "Run " },
      { kind: "code", text: "rex check" },
      { kind: "text", text: " on " },
      {
        kind: "link",
        href: "https://example.com/c",
        children: [{ kind: "code", text: "11c79cb" }],
      },
      { kind: "text", text: " " },
      { kind: "strong", text: "now" },
      { kind: "text", text: "." },
    ]);
    expect(parseInline("a `[spec:x/1]` tag")).toEqual([
      { kind: "text", text: "a " },
      { kind: "code", text: "[spec:x/1]" },
      { kind: "text", text: " tag" },
    ]);
  });

  it("reads a details block with its summary and commit list", () => {
    const changelog = parseChangelog(
      [
        "# Changelog",
        "",
        "Intro line one.  ",
        "Intro line two.",
        "",
        "## 1.0.0",
        "",
        "### Other",
        "",
        "<details>",
        "<summary>Commit log (2026-10-04)</summary>",
        "",
        "- first",
        "- second",
        "",
        "</details>",
      ].join("\n"),
      "example.md",
    );
    expect(changelog.intro).toEqual([
      { kind: "paragraph", inlines: [{ kind: "text", text: "Intro line one. Intro line two." }] },
    ]);
    expect(changelog.releases).toEqual([
      {
        version: "1.0.0",
        slug: "release-1-0-0",
        blocks: [],
        sections: [
          {
            title: "Other",
            slug: "1-0-0-other",
            blocks: [
              {
                kind: "details",
                summary: [{ kind: "text", text: "Commit log (2026-10-04)" }],
                blocks: [
                  {
                    kind: "list",
                    items: [[{ kind: "text", text: "first" }], [{ kind: "text", text: "second" }]],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("refuses markdown the site does not render instead of dropping it", () => {
    expect(() => parseChangelog("# C\n\n## 1.0.0\n\n<table>\n", "bad.md")).toThrow(
      "changelog: bad.md:5 has HTML the site does not render: <table>",
    );
    expect(() => parseChangelog("# C\n\n## 1.0.0\n\n```sh\n", "bad.md")).toThrow(
      "changelog: bad.md:5 uses a block the site does not render",
    );
    expect(() => parseChangelog("# C\n\n## 1.0.0\n\n#### Deep\n", "bad.md")).toThrow(
      "changelog: bad.md:5 has a level 4 heading out of place",
    );
    expect(() => parseChangelog("# C\n\n## 1.0.0\n\n<details>\n", "bad.md")).toThrow(
      "ends inside an open <details>",
    );
  });
});
