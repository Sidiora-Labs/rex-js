import { page } from "@sidioralabs/rex";
import { listDocs } from "../../actions/docs/list-docs.ts";
import { loadSearchIndex } from "../../actions/docs/load-search-index.ts";

export default page("docs", {
  route: "/docs",
  render: "ssg",
  affordances: [
    {
      id: "search-docs",
      label: "Search the docs",
      effect: "read",
      input: {
        type: "object",
        properties: { query: { type: "string" } },
        additionalProperties: false,
      },
      via: ["click", "palette"],
    },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      effect: "reversible",
      input: { type: "object", properties: {}, additionalProperties: false },
      via: ["click", "palette"],
    },
  ],
  load: { docs: listDocs, search: loadSearchIndex },
  chrome: { title: "Docs", back: "home" },
  regions: ["index", "search"],
});
