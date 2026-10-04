import { page } from "@sidioralabs/rex";

export default page("settings", {
  route: "/settings",
  regions: ["theme"],
  states: ["loading", "ready"],
});
