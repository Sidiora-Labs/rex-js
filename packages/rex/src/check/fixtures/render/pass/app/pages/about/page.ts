import { page } from "@sidioralabs/rex";
import { subscribe } from "../../actions/subscribe.ts";

export default page("about", {
  route: "/about",
  render: "static",
  actions: [subscribe],
  regions: ["body"],
  overlays: [{ id: "HelpSheet", dismiss: "both", binding: "url" }],
});
