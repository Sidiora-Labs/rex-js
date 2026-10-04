import { can, page, text, z } from "../../../index.ts";
import { addNote } from "../actions.ts";

export default page("notes", {
  route: "/notes",
  params: z.object({ filter: text({ min: 1 }).optional() }),
  policy: can("notes.read"),
  actions: [addNote],
  chrome: { title: "Notes" },
  regions: ["list", "composer"],
});
