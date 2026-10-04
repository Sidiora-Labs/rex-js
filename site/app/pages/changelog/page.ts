import { page } from "@sidioralabs/rex";
import { readChangelog } from "../../actions/read-changelog.ts";

export default page("changelog", {
  route: "/changelog",
  render: "static",
  load: { changelog: readChangelog },
  chrome: { title: "Changelog", back: "home" },
  regions: ["releases"],
});
