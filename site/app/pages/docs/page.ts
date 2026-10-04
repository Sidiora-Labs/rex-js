import { page } from "@sidioralabs/rex";
import { listDocs } from "../../actions/docs/list-docs.ts";
import { loadSearchIndex } from "../../actions/docs/load-search-index.ts";

export default page("docs", {
  route: "/docs",
  render: "ssg",
  load: { docs: listDocs, search: loadSearchIndex },
  chrome: { title: "Docs", back: "home" },
  regions: ["index", "search"],
});
