import { RexError } from "./errors.ts";

export type FlowStatus = "running" | "paused" | "completed" | "rejected" | "failed";

export const FLOW_STATUSES: readonly FlowStatus[] = [
  "running",
  "paused",
  "completed",
  "rejected",
  "failed",
];

export type FlowDecision = "approve" | "reject";

export type JournalEntry =
  | {
      readonly type: "step";
      readonly index: number;
      readonly action: string;
      readonly output: unknown;
      readonly at: string;
    }
  | { readonly type: "paused"; readonly index: number; readonly gate: string; readonly at: string }
  | {
      readonly type: "decision";
      readonly index: number;
      readonly gate: string;
      readonly decision: FlowDecision;
      readonly actor: string;
      readonly at: string;
    }
  | {
      readonly type: "failed";
      readonly index: number;
      readonly error: string;
      readonly at: string;
    }
  | { readonly type: "completed"; readonly at: string };

export interface FlowInstance {
  readonly flowId: string;
  readonly instanceId: string;
  readonly input: unknown;
  readonly status: FlowStatus;
  readonly entries: readonly JournalEntry[];
}

export interface JournalListFilter {
  readonly flowId?: string;
  readonly status?: FlowStatus;
}

export interface Journal {
  open(flowId: string, instanceId: string, input: unknown): Promise<FlowInstance>;
  record(instanceId: string, entry: JournalEntry): Promise<FlowInstance>;
  load(instanceId: string): Promise<FlowInstance | undefined>;
  list(filter?: JournalListFilter): Promise<FlowInstance[]>;
}

export function statusOf(entries: readonly JournalEntry[]): FlowStatus {
  const last = entries.at(-1);
  if (last === undefined) return "running";
  switch (last.type) {
    case "completed":
      return "completed";
    case "paused":
      return "paused";
    case "failed":
      return "failed";
    case "decision":
      return last.decision === "reject" ? "rejected" : "running";
    case "step":
      return "running";
  }
}

export function completedSteps(entries: readonly JournalEntry[]): ReadonlySet<number> {
  const done = new Set<number>();
  for (const entry of entries) {
    if (entry.type === "step") done.add(entry.index);
    if (entry.type === "decision" && entry.decision === "approve") done.add(entry.index);
  }
  return done;
}

export function isJournal(value: unknown): value is Journal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ["open", "record", "load", "list"].every(
    (method) => typeof candidate[method] === "function",
  );
}

function requireId(field: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RexError("REX302", `journal: ${field} must be a non-empty string`);
  }
  return value;
}

export function memoryJournal(): Journal {
  const instances = new Map<string, { flowId: string; input: unknown; entries: JournalEntry[] }>();

  const snapshot = (instanceId: string): FlowInstance => {
    const stored = instances.get(instanceId);
    if (stored === undefined)
      throw new RexError("REX303", `journal: unknown instance "${instanceId}"`);
    const entries = structuredClone(stored.entries);
    return {
      flowId: stored.flowId,
      instanceId,
      input: structuredClone(stored.input),
      status: statusOf(entries),
      entries,
    };
  };

  return Object.freeze({
    async open(flowId: string, instanceId: string, input: unknown): Promise<FlowInstance> {
      requireId("flowId", flowId);
      requireId("instanceId", instanceId);
      const existing = instances.get(instanceId);
      if (existing !== undefined && existing.flowId !== flowId) {
        throw new RexError(
          "REX304",
          `journal: instance "${instanceId}" belongs to flow "${existing.flowId}", not "${flowId}"`,
        );
      }
      if (existing === undefined) {
        instances.set(instanceId, { flowId, input: structuredClone(input), entries: [] });
      }
      return snapshot(instanceId);
    },
    async record(instanceId: string, entry: JournalEntry): Promise<FlowInstance> {
      const stored = instances.get(requireId("instanceId", instanceId));
      if (stored === undefined)
        throw new RexError("REX303", `journal: unknown instance "${instanceId}"`);
      stored.entries.push(structuredClone(entry));
      return snapshot(instanceId);
    },
    async load(instanceId: string): Promise<FlowInstance | undefined> {
      return instances.has(instanceId) ? snapshot(instanceId) : undefined;
    },
    async list(filter: JournalListFilter = {}): Promise<FlowInstance[]> {
      return [...instances.keys()]
        .sort()
        .map(snapshot)
        .filter(
          (instance) =>
            (filter.flowId === undefined || instance.flowId === filter.flowId) &&
            (filter.status === undefined || instance.status === filter.status),
        );
    },
  });
}
