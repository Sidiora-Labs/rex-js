import { useQuery } from "@tanstack/react-query";
import { notes } from "../../../data/notes.ts";

export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: async () => (await notes.list()).items,
  });
}
