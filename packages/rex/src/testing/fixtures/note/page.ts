import { can, page } from "../../../index.ts";
import { id } from "../../../schema/index.ts";
import { z } from "zod/mini";

export default page("note", {
  route: "/notes/:noteId",
  params: z.object({ noteId: id() }),
  policy: can("notes.read"),
  chrome: { title: "Note", back: "notes", nav: false },
  regions: ["detail"],
  states: ["loading", "terminal-error", "ready"],
});
