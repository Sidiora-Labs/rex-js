import { page } from "@sidioralabs/rex";
import { addNote } from "../../actions/add-note.ts";

export default page("home", {
  route: "/",
  render: "ssg",
  actions: [addNote],
  regions: ["list"],
  overlays: [{ id: "NoteSheet", dismiss: "both", binding: "region" }],
});
