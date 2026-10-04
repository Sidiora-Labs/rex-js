import { queryOptions } from "@tanstack/react-query";
import { procedureOf, type RexClient } from "../../client/index.ts";
import { listNotes } from "./actions.ts";

export const NOTES_QUERY = "notes";

export function notesQuery(client: RexClient) {
  return queryOptions({
    queryKey: [NOTES_QUERY],
    queryFn: async () => listNotes.output.parse(await procedureOf(client, listNotes.id)({})).notes,
  });
}
