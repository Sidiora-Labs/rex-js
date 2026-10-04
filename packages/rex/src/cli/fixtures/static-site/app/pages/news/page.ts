import { page } from "@sidioralabs/rex";

export default page("news", {
  route: "/news",
  render: "ssg",
  chrome: { title: "News" },
  regions: ["latest"],
  states: ["loading", "ready"],
});
