import "@sidioralabs/rex/server-only";

export const SERVER_DB_MARKER = "server-db-connection";
const databaseUrl = process.env.DATABASE_URL ?? "file:notes.db";

export function insertNote(title: string): { id: string; title: string } {
  return { id: `note-${SERVER_DB_MARKER.length}-${databaseUrl.length}`, title };
}

export function archiveNote(id: string): { id: string; title: string } {
  return { id, title: `archived-by-${SERVER_DB_MARKER}` };
}
