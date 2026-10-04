import { ACTION_EFFECTS, type ActionEffect } from "../core/action.ts";
import { isPlainObject } from "../core/entity.ts";
import { stableStringify } from "../manifest/build.ts";

export const AUDIT_OK = "ok";
export const AUDIT_ERROR_FILTER = "error";

export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
export const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export type AuditOutcome = typeof AUDIT_OK | (string & {});

export interface AuditRecord {
  readonly id: string;
  readonly actor: string;
  readonly actionId: string;
  readonly inputDigest: string;
  readonly outcome: AuditOutcome;
  readonly effect: ActionEffect;
  readonly durationMs: number;
  readonly at: string;
}

export type AuditEntry = Omit<AuditRecord, "id">;

export interface AuditFilter {
  readonly actor?: string;
  readonly actionId?: string;
  readonly outcome?: AuditOutcome | typeof AUDIT_ERROR_FILTER;
  readonly from?: string;
  readonly to?: string;
}

export interface Ledger {
  append(entry: AuditEntry): Promise<AuditRecord>;
  list(filter?: AuditFilter): Promise<AuditRecord[]>;
}

export interface AuditEntryInput {
  readonly actor: string;
  readonly actionId: string;
  readonly input: unknown;
  readonly outcome: AuditOutcome;
  readonly effect: ActionEffect;
  readonly durationMs: number;
  readonly at: string;
}

const ENTRY_KEYS = ["actor", "actionId", "inputDigest", "outcome", "effect", "durationMs", "at"];
const FILTER_KEYS = new Set(["actor", "actionId", "outcome", "from", "to"]);

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(input: unknown): string {
  return stableStringify(input === undefined ? null : input, 0);
}

export async function digest(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(input));
  return toHex(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

function timeOf(field: string, value: unknown): number {
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) {
    throw new TypeError(
      `audit: ${field} must be an ISO timestamp, received ${JSON.stringify(value)}`,
    );
  }
  return time;
}

function nonEmpty(field: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`audit: ${field} must be a non-empty string`);
  }
  return value;
}

export function isAuditOutcome(value: unknown): value is AuditOutcome {
  return value === AUDIT_OK || (typeof value === "string" && ERROR_CODE_PATTERN.test(value));
}

export function validateAuditEntry(entry: AuditEntry): AuditEntry {
  if (!isPlainObject(entry)) throw new TypeError("audit: entry must be an object");
  for (const property of Object.keys(entry)) {
    if (!ENTRY_KEYS.includes(property)) {
      throw new TypeError(`audit: "${property}" is not part of an audit entry`);
    }
  }
  nonEmpty("actor", entry.actor);
  nonEmpty("actionId", entry.actionId);
  if (typeof entry.inputDigest !== "string" || !DIGEST_PATTERN.test(entry.inputDigest)) {
    throw new TypeError("audit: inputDigest must be a lowercase hex sha-256 digest");
  }
  if (!isAuditOutcome(entry.outcome)) {
    throw new TypeError(
      `audit: outcome must be "${AUDIT_OK}" or an UPPER_SNAKE error code, received ${JSON.stringify(entry.outcome)}`,
    );
  }
  if (!ACTION_EFFECTS.includes(entry.effect)) {
    throw new TypeError(`audit: effect must be one of ${ACTION_EFFECTS.join(", ")}`);
  }
  if (
    typeof entry.durationMs !== "number" ||
    !Number.isFinite(entry.durationMs) ||
    entry.durationMs < 0
  ) {
    throw new TypeError("audit: durationMs must be a finite non-negative number");
  }
  timeOf("at", entry.at);
  return {
    actor: entry.actor,
    actionId: entry.actionId,
    inputDigest: entry.inputDigest,
    outcome: entry.outcome,
    effect: entry.effect,
    durationMs: entry.durationMs,
    at: entry.at,
  };
}

export async function createAuditEntry(params: AuditEntryInput): Promise<AuditEntry> {
  return validateAuditEntry({
    actor: params.actor,
    actionId: params.actionId,
    inputDigest: await digest(params.input),
    outcome: params.outcome,
    effect: params.effect,
    durationMs: params.durationMs,
    at: params.at,
  });
}

export function matchesAuditFilter(record: AuditRecord, filter: AuditFilter): boolean {
  if (filter.actor !== undefined && record.actor !== filter.actor) return false;
  if (filter.actionId !== undefined && record.actionId !== filter.actionId) return false;
  if (filter.outcome !== undefined) {
    if (filter.outcome === AUDIT_ERROR_FILTER) {
      if (record.outcome === AUDIT_OK) return false;
    } else if (record.outcome !== filter.outcome) {
      return false;
    }
  }
  const at = Date.parse(record.at);
  if (filter.from !== undefined && at < Date.parse(filter.from)) return false;
  if (filter.to !== undefined && at >= Date.parse(filter.to)) return false;
  return true;
}

function validateFilter(filter: AuditFilter): AuditFilter {
  if (!isPlainObject(filter)) throw new TypeError("audit: filter must be an object");
  for (const property of Object.keys(filter)) {
    if (!FILTER_KEYS.has(property)) throw new TypeError(`audit: unknown filter "${property}"`);
  }
  if (filter.actor !== undefined) nonEmpty("filter.actor", filter.actor);
  if (filter.actionId !== undefined) nonEmpty("filter.actionId", filter.actionId);
  if (
    filter.outcome !== undefined &&
    filter.outcome !== AUDIT_ERROR_FILTER &&
    !isAuditOutcome(filter.outcome)
  ) {
    throw new TypeError(
      `audit: filter.outcome must be "${AUDIT_OK}", "${AUDIT_ERROR_FILTER}" or an error code`,
    );
  }
  const from = filter.from === undefined ? undefined : timeOf("filter.from", filter.from);
  const to = filter.to === undefined ? undefined : timeOf("filter.to", filter.to);
  if (from !== undefined && to !== undefined && from > to) {
    throw new RangeError("audit: filter.from must not be after filter.to");
  }
  return filter;
}

export function memoryLedger(): Ledger {
  const records: AuditRecord[] = [];
  let sequence = 0;

  return Object.freeze({
    async append(entry: AuditEntry): Promise<AuditRecord> {
      const valid = validateAuditEntry(entry);
      sequence += 1;
      const record: AuditRecord = Object.freeze({
        id: `audit-${String(sequence).padStart(6, "0")}`,
        ...valid,
      });
      records.push(record);
      return record;
    },
    async list(filter: AuditFilter = {}): Promise<AuditRecord[]> {
      const valid = validateFilter(filter);
      return records
        .filter((record) => matchesAuditFilter(record, valid))
        .sort(
          (a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        );
    },
  });
}
