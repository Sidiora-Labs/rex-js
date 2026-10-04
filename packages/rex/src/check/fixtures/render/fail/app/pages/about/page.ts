import { page } from "@sidioralabs/rex";
import { addNote } from "../../actions/add-note.ts";
import { subscribe } from "../../actions/subscribe.ts";

export default page("about", {
  route: "/about",
  render: "static",
  actions: [subscribe, addNote],
  regions: ["body"],
  overlays: [
    { id: "HelpSheet", dismiss: "both", binding: "url" },
    { id: "NoteSheet", dismiss: "both", binding: "region" },
  ],
});
