import { page } from "@sidioralabs/rex";
import { errorsCatalog } from "../../actions/errors/errors-catalog.ts";

export default page("errors", {
  route: "/errors",
  render: "ssg",
  affordances: [
    {
      id: "toggle-theme",
      label: "Toggle theme",
      effect: "reversible",
      input: { type: "object", properties: {}, additionalProperties: false },
      via: ["click", "palette"],
    },
  ],
  draft: "route",
  load: { catalog: errorsCatalog },
  chrome: { title: "Errors", back: "home" },
  regions: ["catalog"],
});
