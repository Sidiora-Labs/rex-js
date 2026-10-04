import type { FlowDecision, FlowStatus } from "./journal.ts";
import { REX_SCHEMA_VENDOR } from "./schema.ts";
import type { StandardIssue, StandardResult, StandardSchemaV1 } from "./standard.ts";

export const CONFIRM_PROCEDURE = "_confirm";

export const REX_CONFIRM_HEADER = "x-rex-confirm";
export const REX_ACTOR_HEADER = "x-rex-actor";
export const REX_DENSITY_HEADER = "x-rex-density";

export const REX_RPC_PREFIX = "/rex/rpc";
export const REX_MANIFEST_PATH = "/rex/manifest";
export const FLOW_RPC_PREFIX = "/rex/flow";

export const RESERVED_QUERY_KEYS = ["act", "input", "draft", "density"] as const;

export type ReservedQueryKey = (typeof RESERVED_QUERY_KEYS)[number];

export function isReservedQueryKey(key: string): key is ReservedQueryKey {
  return (RESERVED_QUERY_KEYS as readonly string[]).includes(key);
}

export const REX_DENSITIES = ["default", "agent"] as const;

export type RexDensity = (typeof REX_DENSITIES)[number];

export const DEFAULT_DENSITY: RexDensity = "default";

export function isRexDensity(value: unknown): value is RexDensity {
  return typeof value === "string" && (REX_DENSITIES as readonly string[]).includes(value);
}

export const SIDECAR_MIME_TYPE = "application/rex+json";
export const SIDECAR_ELEMENT_ID = "rex-page";
export const SIDECAR_VERSION = 1;

export const INVOCATION_ROUTES = ["click", "key", "palette", "url"] as const;

export type InvocationRoute = (typeof INVOCATION_ROUTES)[number];

type FieldRule = (value: unknown) => string | null;

type FieldRules = Readonly<Record<string, FieldRule>>;

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const nonEmptyText: FieldRule = (value) =>
  typeof value === "string" && value.length > 0 ? null : "expected a non-empty string";

const isoDatetime: FieldRule = (value) =>
  typeof value === "string" && ISO_DATETIME.test(value) && !Number.isNaN(Date.parse(value))
    ? null
    : "expected an ISO datetime";

const anyValue: FieldRule = () => null;

const stepCount: FieldRule = (value) =>
  Number.isInteger(value) && (value as number) >= 0 ? null : "expected a non-negative integer";

function oneOf(values: readonly string[]): FieldRule {
  return (value) =>
    typeof value === "string" && values.includes(value)
      ? null
      : `expected one of ${values.join(", ")}`;
}

function recordIssues(
  value: unknown,
  rules: FieldRules,
  strict: boolean,
  path: readonly PropertyKey[],
): StandardIssue[] {
  if (!isRecord(value)) return [{ message: "expected an object", path: [...path] }];
  const issues: StandardIssue[] = [];
  for (const [name, rule] of Object.entries(rules)) {
    const problem = rule(value[name]);
    if (problem !== null) issues.push({ message: problem, path: [...path, name] });
  }
  if (strict) {
    for (const name of Object.keys(value)) {
      if (!Object.hasOwn(rules, name)) {
        issues.push({ message: `unrecognized key "${name}"`, path: [...path, name] });
      }
    }
  }
  return issues;
}

function nullableRecord(rules: FieldRules): FieldRule {
  return (value) => {
    if (value === null) return null;
    const issues = recordIssues(value, rules, true, []);
    return issues.length === 0
      ? null
      : issues.map((issue) => `${(issue.path ?? []).join(".")} ${issue.message}`.trim()).join("; ");
  };
}

export type ProtocolSchema<T> = StandardSchemaV1<T, T>;

function protocolSchema<T>(rules: FieldRules, strict: boolean): ProtocolSchema<T> {
  const fields = Object.keys(rules);
  const validate = (value: unknown): StandardResult<T> => {
    const issues = recordIssues(value, rules, strict, []);
    if (issues.length > 0) return { issues };
    const record = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const name of fields) {
      if (Object.hasOwn(record, name)) output[name] = record[name];
    }
    return { value: output as T };
  };
  return Object.freeze({
    "~standard": Object.freeze({ version: 1 as const, vendor: REX_SCHEMA_VENDOR, validate }),
  });
}

export interface ConfirmInput {
  readonly action: string;
  readonly input?: unknown;
}

export interface ConfirmOutput {
  readonly token: string;
  readonly action: string;
  readonly inputDigest: string;
  readonly expiresAt: string;
}

export interface ConfirmGrant {
  readonly token: string;
  readonly expiresAt: string;
}

export const confirmInputSchema: ProtocolSchema<ConfirmInput> = /* @__PURE__ */ protocolSchema(
  { action: nonEmptyText, input: anyValue },
  true,
);

export const confirmOutputSchema: ProtocolSchema<ConfirmOutput> = /* @__PURE__ */ protocolSchema(
  { token: nonEmptyText, action: nonEmptyText, inputDigest: nonEmptyText, expiresAt: isoDatetime },
  true,
);

export const confirmGrantSchema: ProtocolSchema<ConfirmGrant> = /* @__PURE__ */ protocolSchema(
  { token: nonEmptyText, expiresAt: isoDatetime },
  false,
);

export const FLOW_DECISIONS: readonly FlowDecision[] = ["approve", "reject"];

export type FlowStateStatus = FlowStatus | "idle";

export const FLOW_STATE_STATUSES: readonly FlowStateStatus[] = [
  "idle",
  "running",
  "paused",
  "completed",
  "rejected",
  "failed",
];

export interface FlowInstanceInput {
  readonly flow: string;
  readonly instance: string;
}

export interface FlowStartInput extends FlowInstanceInput {
  readonly input?: unknown;
}

export interface FlowDecideInput extends FlowInstanceInput {
  readonly decision: FlowDecision;
}

export interface FlowGateState {
  readonly id: string;
  readonly label: string;
}

export interface FlowState {
  readonly flow: string;
  readonly instance: string;
  readonly status: FlowStateStatus;
  readonly gate: FlowGateState | null;
  readonly completed: number;
}

const flowInstanceRules: FieldRules = { flow: nonEmptyText, instance: nonEmptyText };

export const flowInstanceInputSchema: ProtocolSchema<FlowInstanceInput> =
  /* @__PURE__ */ protocolSchema(flowInstanceRules, true);

export const flowStartInputSchema: ProtocolSchema<FlowStartInput> = /* @__PURE__ */ protocolSchema(
  { ...flowInstanceRules, input: anyValue },
  true,
);

export const flowDecideInputSchema: ProtocolSchema<FlowDecideInput> =
  /* @__PURE__ */ protocolSchema({ ...flowInstanceRules, decision: oneOf(FLOW_DECISIONS) }, true);

export const flowStateSchema: ProtocolSchema<FlowState> = /* @__PURE__ */ protocolSchema(
  {
    ...flowInstanceRules,
    status: oneOf(FLOW_STATE_STATUSES),
    gate: nullableRecord({ id: nonEmptyText, label: nonEmptyText }),
    completed: stepCount,
  },
  true,
);
