import { useQuery } from "@tanstack/react-query";
import { useRexClient } from "../../../../client/index.ts";
import { notesQuery } from "../../notes-query.ts";

export function useNotes() {
  return useQuery(notesQuery(useRexClient()));
}
