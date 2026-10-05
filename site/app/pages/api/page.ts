import { page } from "@sidioralabs/rex";
import { listApi } from "../../actions/api/list-api.ts";
import { loadApiSearchIndex } from "../../actions/api/load-api-search-index.ts";

export default page("api", {
  route: "/api",
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
  load: { entries: listApi, search: loadApiSearchIndex },
  chrome: { title: "API", back: "home" },
  regions: ["entries", "search"],
});
