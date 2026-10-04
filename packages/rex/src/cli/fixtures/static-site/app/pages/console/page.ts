import { page } from "@sidioralabs/rex";

export default page("console", {
  route: "/console",
  render: "csr",
  chrome: { title: "Console" },
  regions: ["panel"],
  states: ["loading", "ready"],
});
