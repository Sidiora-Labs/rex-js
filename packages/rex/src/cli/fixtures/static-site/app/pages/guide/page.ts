import { page } from "@sidioralabs/rex";

export default page("guide", {
  route: "/guide",
  render: "static",
  chrome: { title: "Guide" },
  regions: ["intro"],
  states: ["loading", "ready"],
});
