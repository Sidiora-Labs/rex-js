import { page } from "@sidioralabs/rex";
import { listApi } from "../../actions/api/list-api.ts";
import { loadApiSearchIndex } from "../../actions/api/load-api-search-index.ts";

export default page("api", {
  route: "/api",
  render: "ssg",
  load: { entries: listApi, search: loadApiSearchIndex },
  chrome: { title: "API", back: "home" },
  regions: ["entries", "search"],
});
