import { registerReset } from "../../client/reset.ts";

export interface NoteRecord {
  readonly id: string;
  readonly title: string;
}

export const SEED_NOTES: readonly NoteRecord[] = Object.freeze([
  Object.freeze({ id: "n1", title: "Buy milk" }),
  Object.freeze({ id: "n2", title: "Call Ada" }),
]);

let records: readonly NoteRecord[] = SEED_NOTES;

export function listRecords(): readonly NoteRecord[] {
  return records;
}

export function addRecord(title: string): NoteRecord {
  const record = Object.freeze({ id: `n${records.length + 1}`, title });
  records = Object.freeze([...records, record]);
  return record;
}

registerReset(() => {
  records = SEED_NOTES;
});
