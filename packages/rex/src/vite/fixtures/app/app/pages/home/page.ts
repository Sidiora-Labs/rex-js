import { page } from "@sidioralabs/rex";
import { addNote } from "../../actions/add-note.ts";

export default page("home", {
  route: "/",
  actions: [addNote],
  chrome: { title: "Notes" },
  regions: ["list", "composer"],
  overlays: [{ id: "NoteSheet", dismiss: "both", binding: "region" }],
});
