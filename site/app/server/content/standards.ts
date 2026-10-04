import { readFileSync } from "node:fs";
import path from "node:path";

export const REPOSITORY_ROOT = path.resolve(process.cwd(), "..");
export const STANDARDS_SOURCE = "spec/rex-v02/spec.kvx";

export type KvxValue = string | number | boolean | readonly KvxValue[];

export interface KvxSection {
  readonly name: string;
  readonly entries: ReadonlyMap<string, KvxValue>;
}

export type StandardStatus = "met" | "partial";

export interface StandardTask {
  readonly id: string;
  readonly status: string;
}

export interface StandardItem {
  readonly id: string;
  readonly area: string;
  readonly requirement: string;
  readonly status: StandardStatus;
  readonly recorded: string;
  readonly tasks: StandardTask[];
}

export interface StandardsTable {
  readonly source: string;
  readonly total: number;
  readonly met: number;
  readonly items: StandardItem[];
}

const SECTION_LINE = /^\[([^\]]+)\]\s*$/;
const ENTRY_LINE = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/;
const ITEM_KEY = /^s\d+$/;
const RECORDED_MET = /^met\b/;
const STANDARD_PREFIX = "standard.";
const TASK_PREFIX = "task.";

function parseValue(raw: string, where: string): KvxValue {
  try {
    return JSON.parse(raw) as KvxValue;
  } catch {
    throw new Error(`kvx: ${where} has a value that is not a quoted string, number or list`);
  }
}

export function parseKvx(text: string, file: string): readonly KvxSection[] {
  const sections: { name: string; entries: Map<string, KvxValue> }[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const where = `${file}:${index + 1}`;
    const section = SECTION_LINE.exec(trimmed);
    if (section !== null) {
      sections.push({ name: section[1] as string, entries: new Map() });
      return;
    }
    const entry = ENTRY_LINE.exec(trimmed);
    const current = sections.at(-1);
    if (entry === null || current === undefined) {
      throw new Error(`kvx: ${where} is neither a section header nor a key = value line`);
    }
    const key = entry[1] as string;
    if (current.entries.has(key)) {
      throw new Error(`kvx: ${where} repeats the key ${key} in [${current.name}]`);
    }
    current.entries.set(key, parseValue((entry[2] as string).trim(), where));
  });
  return sections;
}

function stringEntry(section: KvxSection, key: string): string {
  const value = section.entries.get(key);
  if (typeof value !== "string") {
    throw new Error(`standards: [${section.name}] ${key} is not a string`);
  }
  return value;
}

function listEntry(section: KvxSection, key: string): readonly string[] {
  const value = section.entries.get(key);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`standards: [${section.name}] ${key} is not a list of task ids`);
  }
  return value as readonly string[];
}

function itemOrder(key: string): number {
  return Number(key.slice(1));
}

export function standardsFromSpec(text: string, source: string = STANDARDS_SOURCE): StandardsTable {
  const sections = parseKvx(text, source);
  const taskStatus = new Map<string, string>();
  for (const section of sections) {
    if (!section.name.startsWith(TASK_PREFIX)) continue;
    taskStatus.set(section.name.slice(TASK_PREFIX.length), stringEntry(section, "status"));
  }
  const items: StandardItem[] = [];
  for (const section of sections) {
    if (!section.name.startsWith(STANDARD_PREFIX)) continue;
    const area = section.name.slice(STANDARD_PREFIX.length);
    const keys = [...section.entries.keys()]
      .filter((key) => ITEM_KEY.test(key))
      .sort((a, b) => itemOrder(a) - itemOrder(b));
    for (const key of keys) {
      const id = `${area}.${key}`;
      const tasks = listEntry(section, `${key}_tasks`).map((task) => {
        const status = taskStatus.get(task);
        if (status === undefined) {
          throw new Error(`standards: ${id} names task ${task}, which ${source} does not declare`);
        }
        return { id: task, status };
      });
      const recorded = stringEntry(section, `${key}_now`);
      const met =
        tasks.length === 0
          ? RECORDED_MET.test(recorded)
          : tasks.every((task) => task.status === "done");
      items.push({
        id,
        area,
        requirement: stringEntry(section, key),
        status: met ? "met" : "partial",
        recorded,
        tasks,
      });
    }
  }
  if (items.length === 0) throw new Error(`standards: ${source} declares no [standard.*] item`);
  return {
    source,
    total: items.length,
    met: items.filter((item) => item.status === "met").length,
    items,
  };
}

export function readStandards(root: string = REPOSITORY_ROOT): StandardsTable {
  return standardsFromSpec(readFileSync(path.join(root, STANDARDS_SOURCE), "utf8"));
}
