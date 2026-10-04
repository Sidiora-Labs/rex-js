import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REPOSITORY_ROOT,
  STANDARDS_SOURCE,
  parseKvx,
  readStandards,
  standardsFromSpec,
} from "./standards.ts";

const ROOT = path.resolve(process.cwd(), "..");
const SPEC = readFileSync(path.join(ROOT, "spec/rex-v02/spec.kvx"), "utf8");

interface ExpectedItem {
  readonly id: string;
  readonly requirement: string;
  readonly recorded: string;
  readonly tasks: readonly string[];
}

function expectedFromSpec(): {
  readonly items: readonly ExpectedItem[];
  readonly statuses: ReadonlyMap<string, string>;
} {
  const items: { id: string; requirement: string; recorded: string; tasks: readonly string[] }[] =
    [];
  const statuses = new Map<string, string>();
  let area: string | null = null;
  let task: string | null = null;
  for (const line of SPEC.split("\n")) {
    const header = /^\[(.+)\]$/.exec(line.trim());
    if (header !== null) {
      const name = header[1] as string;
      area = name.startsWith("standard.") ? name.slice("standard.".length) : null;
      task = name.startsWith("task.") ? name.slice("task.".length) : null;
      continue;
    }
    const status = /^status\s*=\s*"(.+)"$/.exec(line.trim());
    if (task !== null && status !== null) statuses.set(task, status[1] as string);
    if (area === null) continue;
    const requirement = /^(s\d+)\s*=\s*(".*")$/.exec(line.trim());
    if (requirement !== null) {
      items.push({
        id: `${area}.${requirement[1] as string}`,
        requirement: JSON.parse(requirement[2] as string) as string,
        recorded: "",
        tasks: [],
      });
    }
    const recorded = /^(s\d+)_now\s*=\s*(".*")$/.exec(line.trim());
    if (recorded !== null) {
      const id = `${area}.${recorded[1] as string}`;
      const item = items.find((candidate) => candidate.id === id);
      if (item === undefined) throw new Error(`${id}_now comes before ${id}`);
      item.recorded = JSON.parse(recorded[2] as string) as string;
    }
    const tasks = /^(s\d+)_tasks\s*=\s*(\[.*\])$/.exec(line.trim());
    if (tasks !== null) {
      const id = `${area}.${tasks[1] as string}`;
      const item = items.find((candidate) => candidate.id === id);
      if (item === undefined) throw new Error(`${id}_tasks comes before ${id}`);
      item.tasks = JSON.parse(tasks[2] as string) as string[];
    }
  }
  const areas = [...new Set(items.map((item) => item.id.split(".")[0]))];
  const rank = (id: string) => {
    const [area, key] = id.split(".") as [string, string];
    return areas.indexOf(area) * 1000 + Number(key.slice(1));
  };
  items.sort((a, b) => rank(a.id) - rank(b.id));
  return { items, statuses };
}

describe("standards reader", () => {
  it("reads the spec of the repository the site is built from", () => {
    expect(REPOSITORY_ROOT).toBe(ROOT);
    expect(existsSync(path.join(REPOSITORY_ROOT, "packages/rex/package.json"))).toBe(true);
    expect(readStandards().source).toBe(STANDARDS_SOURCE);
  });

  it("lists every [standard.*] item of the spec by area and item number with its requirement", () => {
    const expected = expectedFromSpec();
    const table = readStandards();
    expect(expected.items.length).toBeGreaterThan(0);
    expect(table.items.map((item) => item.id)).toEqual(expected.items.map((item) => item.id));
    expect(table.items.map((item) => item.requirement)).toEqual(
      expected.items.map((item) => item.requirement),
    );
    expect(table.items.map((item) => item.recorded)).toEqual(
      expected.items.map((item) => item.recorded),
    );
    expect(table.total).toBe(expected.items.length);
  });

  it("carries each owning task with the status the spec records for it", () => {
    const expected = expectedFromSpec();
    const table = readStandards();
    for (const [index, item] of table.items.entries()) {
      const source = expected.items[index] as ExpectedItem;
      expect(item.tasks.map((task) => task.id)).toEqual(source.tasks);
      for (const task of item.tasks) {
        expect(task.status, `${item.id} task ${task.id}`).toBe(expected.statuses.get(task.id));
      }
    }
  });

  it("marks a standard met when every owning task is done, or when it has none and was recorded met", () => {
    const expected = expectedFromSpec();
    const table = readStandards();
    for (const [index, item] of table.items.entries()) {
      const source = expected.items[index] as ExpectedItem;
      const done =
        source.tasks.length === 0
          ? source.recorded.startsWith("met")
          : source.tasks.every((task) => expected.statuses.get(task) === "done");
      expect(item.status, item.id).toBe(done ? "met" : "partial");
    }
    expect(table.met).toBe(table.items.filter((item) => item.status === "met").length);
  });

  it("computes the status from the task statuses of the document it reads", () => {
    const table = standardsFromSpec(
      [
        "[standard.example]",
        's1 = "First"',
        's1_now = "gap"',
        's1_tasks = ["1.1", "1.2"]',
        's2 = "Second"',
        's2_now = "partial"',
        's2_tasks = ["1.1"]',
        's3 = "Third"',
        's3_now = "met: already true"',
        "s3_tasks = []",
        's4 = "Fourth"',
        's4_now = "gap"',
        "s4_tasks = []",
        "",
        "[task.1.1]",
        'status = "done"',
        "",
        "[task.1.2]",
        'status = "implemented"',
      ].join("\n"),
      "example.kvx",
    );
    expect(table.items).toEqual([
      {
        id: "example.s1",
        area: "example",
        requirement: "First",
        status: "partial",
        recorded: "gap",
        tasks: [
          { id: "1.1", status: "done" },
          { id: "1.2", status: "implemented" },
        ],
      },
      {
        id: "example.s2",
        area: "example",
        requirement: "Second",
        status: "met",
        recorded: "partial",
        tasks: [{ id: "1.1", status: "done" }],
      },
      {
        id: "example.s3",
        area: "example",
        requirement: "Third",
        status: "met",
        recorded: "met: already true",
        tasks: [],
      },
      {
        id: "example.s4",
        area: "example",
        requirement: "Fourth",
        status: "partial",
        recorded: "gap",
        tasks: [],
      },
    ]);
    expect(table.met).toBe(2);
    expect(table.total).toBe(4);
  });

  it("refuses a standard whose owning task the spec does not declare", () => {
    expect(() =>
      standardsFromSpec(
        '[standard.example]\ns1 = "First"\ns1_now = "gap"\ns1_tasks = ["9.9"]\n',
        "example.kvx",
      ),
    ).toThrow("standards: example.s1 names task 9.9, which example.kvx does not declare");
  });

  it("parses kvx sections, quoted strings, lists and numbers, and refuses malformed lines", () => {
    const sections = parseKvx(
      '# comment\n[meta]\nname = "Rex \\"0.2\\""\nwave = 2\nrequires = ["1.1"]\n',
      "meta.kvx",
    );
    expect(sections.map((section) => section.name)).toEqual(["meta"]);
    expect([...(sections[0]?.entries ?? new Map())]).toEqual([
      ["name", 'Rex "0.2"'],
      ["wave", 2],
      ["requires", ["1.1"]],
    ]);
    expect(() => parseKvx("[meta]\nname = unquoted\n", "bad.kvx")).toThrow(
      "kvx: bad.kvx:2 has a value that is not a quoted string, number or list",
    );
    expect(() => parseKvx('name = "orphan"\n', "bad.kvx")).toThrow(
      "kvx: bad.kvx:1 is neither a section header nor a key = value line",
    );
    expect(() => parseKvx('[meta]\na = "1"\na = "2"\n', "bad.kvx")).toThrow(
      "kvx: bad.kvx:3 repeats the key a in [meta]",
    );
  });
});
