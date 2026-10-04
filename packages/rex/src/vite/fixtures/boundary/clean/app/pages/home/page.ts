import { page } from "@sidioralabs/rex";
import { archive } from "../../actions/archive-note.ts";
import { saveNote } from "../../actions/save-note.ts";

export default page("home", {
  route: "/",
  actions: [saveNote, archive],
  chrome: { title: "Notes" },
  regions: ["list"],
  states: ["loading", "ready"],
});
