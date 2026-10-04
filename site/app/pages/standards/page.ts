import { page } from "@sidioralabs/rex";
import { readStandards } from "../../actions/standards/read-standards.ts";

export default page("standards", {
  route: "/standards",
  render: "static",
  load: { standards: readStandards },
  chrome: { title: "Standards", back: "home" },
  regions: ["table"],
});
