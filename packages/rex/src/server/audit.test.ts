import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  AUDIT_OK,
  canonicalJson,
  createAuditEntry,
  digest,
  memoryLedger,
  type AuditEntry,
  type Ledger,
} from "./audit.ts";

const SECRET = "correct-horse-battery-staple";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function entry(overrides: Partial<AuditEntry> = {}): Promise<AuditEntry> {
  return {
    actor: "alice",
    actionId: "send",
    inputDigest: await digest({ to: "bob", amount: "1.00" }),
    outcome: AUDIT_OK,
    effect: "irreversible",
    durationMs: 12,
    at: "2026-10-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("digest", () => {
  it("is sha-256 over canonical JSON with sorted keys", async () => {
    const input = { b: 1, a: { d: [1, "x"], c: true } };
    expect(canonicalJson(input)).toBe('{"a":{"c":true,"d":[1,"x"]},"b":1}');
    expect(await digest(input)).toBe(sha256('{"a":{"c":true,"d":[1,"x"]},"b":1}'));
  });

  it("is stable across key order and calls", async () => {
    const first = await digest({ amount: "1.00", to: "bob", memo: { z: 1, y: 2 } });
    const second = await digest({ memo: { y: 2, z: 1 }, to: "bob", amount: "1.00" });
    expect(first).toBe(second);
    expect(await digest({ amount: "1.00", to: "bob", memo: { z: 1, y: 2 } })).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("distinguishes different inputs", async () => {
    expect(await digest({ amount: "1.00" })).not.toBe(await digest({ amount: "1.01" }));
    expect(await digest([1, 2])).not.toBe(await digest([2, 1]));
  });

  it("digests an absent input as JSON null", async () => {
    expect(await digest(undefined)).toBe(sha256("null"));
    expect(await digest(null)).toBe(sha256("null"));
  });

  it("drops undefined object members like JSON does", async () => {
    expect(await digest({ a: 1, b: undefined })).toBe(await digest({ a: 1 }));
  });
});

describe("createAuditEntry", () => {
  it("replaces the raw input with its digest", async () => {
    const input = { password: SECRET, amount: "5" };
    const created = await createAuditEntry({
      actor: "alice",
      actionId: "unlock",
      input,
      outcome: AUDIT_OK,
      effect: "reversible",
      durationMs: 3,
      at: "2026-10-04T10:00:00.000Z",
    });
    expect(created).toEqual({
      actor: "alice",
      actionId: "unlock",
      inputDigest: await digest(input),
      outcome: AUDIT_OK,
      effect: "reversible",
      durationMs: 3,
      at: "2026-10-04T10:00:00.000Z",
    });
    expect(JSON.stringify(created)).not.toContain(SECRET);
    expect(Object.keys(created)).not.toContain("input");
  });
});

describe("memoryLedger", () => {
  let ledger: Ledger;

  beforeEach(() => {
    ledger = memoryLedger();
  });

  it("appends a record with every audit field and an assigned id", async () => {
    const appended = await ledger.append(await entry());
    expect(appended).toEqual({ id: "audit-000001", ...(await entry()) });
    expect(Object.isFrozen(appended)).toBe(true);
    expect(await ledger.list()).toEqual([appended]);
  });

  it("records a handler failure with its error code", async () => {
    const failed = await ledger.append(await entry({ outcome: "INTERNAL_SERVER_ERROR" }));
    expect(failed.outcome).toBe("INTERNAL_SERVER_ERROR");
    expect(await ledger.list({ outcome: "error" })).toEqual([failed]);
  });

  it("never stores raw input, even when a caller passes it", async () => {
    const leaking = { ...(await entry()), input: { password: SECRET } };
    await expect(ledger.append(leaking as AuditEntry)).rejects.toThrow(
      '"input" is not part of an audit entry',
    );
    await ledger.append(
      await createAuditEntry({
        actor: "alice",
        actionId: "unlock",
        input: { password: SECRET },
        outcome: "FORBIDDEN",
        effect: "reversible",
        durationMs: 1,
        at: "2026-10-04T10:00:00.000Z",
      }),
    );
    const records = await ledger.list();
    expect(records).toHaveLength(1);
    expect(JSON.stringify(records)).not.toContain(SECRET);
  });

  it("rejects malformed entries", async () => {
    await expect(ledger.append(await entry({ actor: "" }))).rejects.toThrow("actor");
    await expect(ledger.append(await entry({ actionId: "" }))).rejects.toThrow("actionId");
    await expect(ledger.append(await entry({ inputDigest: "abc" }))).rejects.toThrow("inputDigest");
    await expect(ledger.append(await entry({ outcome: "failed" }))).rejects.toThrow("outcome");
    await expect(ledger.append(await entry({ effect: "write" as never }))).rejects.toThrow(
      "effect",
    );
    await expect(ledger.append(await entry({ durationMs: -1 }))).rejects.toThrow("durationMs");
    await expect(ledger.append(await entry({ at: "yesterday" }))).rejects.toThrow("at");
    expect(await ledger.list()).toEqual([]);
  });

  describe("list filters", () => {
    beforeEach(async () => {
      await ledger.append(
        await entry({ actor: "alice", actionId: "send", at: "2026-10-04T10:00:00.000Z" }),
      );
      await ledger.append(
        await entry({
          actor: "bob",
          actionId: "send",
          outcome: "FORBIDDEN",
          at: "2026-10-04T11:00:00.000Z",
        }),
      );
      await ledger.append(
        await entry({
          actor: "alice",
          actionId: "toggle-dust",
          effect: "reversible",
          at: "2026-10-04T12:00:00.000Z",
        }),
      );
      await ledger.append(
        await entry({
          actor: "alice",
          actionId: "send",
          outcome: "BAD_REQUEST",
          at: "2026-10-04T09:00:00.000Z",
        }),
      );
    });

    const ids = (records: { id: string }[]) => records.map((record) => record.id);

    it("lists every record ordered by time", async () => {
      expect(ids(await ledger.list())).toEqual([
        "audit-000004",
        "audit-000001",
        "audit-000002",
        "audit-000003",
      ]);
    });

    it("filters by actor", async () => {
      expect(ids(await ledger.list({ actor: "bob" }))).toEqual(["audit-000002"]);
      expect(ids(await ledger.list({ actor: "carol" }))).toEqual([]);
    });

    it("filters by action id", async () => {
      expect(ids(await ledger.list({ actionId: "toggle-dust" }))).toEqual(["audit-000003"]);
    });

    it("filters by outcome: ok, any error, or one error code", async () => {
      expect(ids(await ledger.list({ outcome: "ok" }))).toEqual(["audit-000001", "audit-000003"]);
      expect(ids(await ledger.list({ outcome: "error" }))).toEqual([
        "audit-000004",
        "audit-000002",
      ]);
      expect(ids(await ledger.list({ outcome: "FORBIDDEN" }))).toEqual(["audit-000002"]);
    });

    it("filters by time range with inclusive from and exclusive to", async () => {
      expect(
        ids(
          await ledger.list({ from: "2026-10-04T10:00:00.000Z", to: "2026-10-04T12:00:00.000Z" }),
        ),
      ).toEqual(["audit-000001", "audit-000002"]);
      expect(ids(await ledger.list({ from: "2026-10-04T11:30:00.000Z" }))).toEqual([
        "audit-000003",
      ]);
      expect(ids(await ledger.list({ to: "2026-10-04T10:00:00.000Z" }))).toEqual(["audit-000004"]);
    });

    it("combines filters", async () => {
      expect(ids(await ledger.list({ actor: "alice", actionId: "send", outcome: "ok" }))).toEqual([
        "audit-000001",
      ]);
      expect(
        ids(
          await ledger.list({ actor: "alice", outcome: "error", to: "2026-10-04T09:30:00.000Z" }),
        ),
      ).toEqual(["audit-000004"]);
    });

    it("rejects invalid filters", async () => {
      await expect(ledger.list({ from: "nope" })).rejects.toThrow("filter.from");
      await expect(
        ledger.list({ from: "2026-10-04T12:00:00.000Z", to: "2026-10-04T10:00:00.000Z" }),
      ).rejects.toThrow(expect.objectContaining({ name: "RexError", code: "REX403" }));
      await expect(ledger.list({ outcome: "failed" })).rejects.toThrow("filter.outcome");
      await expect(ledger.list({ input: "x" } as never)).rejects.toThrow('unknown filter "input"');
    });
  });
});
