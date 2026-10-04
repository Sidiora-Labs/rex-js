import { can, id, page, z } from "../../../index.ts";

export default page("note", {
  route: "/notes/:noteId",
  params: z.object({ noteId: id() }),
  policy: can("notes.read"),
  chrome: { title: "Note", back: "notes", nav: false },
  regions: ["detail"],
  states: ["loading", "terminal-error", "ready"],
});
