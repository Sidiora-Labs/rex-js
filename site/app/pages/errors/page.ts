import { page } from "@sidioralabs/rex";
import { errorsCatalog } from "../../actions/errors/errors-catalog.ts";

export default page("errors", {
  route: "/errors",
  render: "ssg",
  draft: "route",
  load: { catalog: errorsCatalog },
  chrome: { title: "Errors", back: "home" },
  regions: ["catalog"],
});
