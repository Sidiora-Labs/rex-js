import { page } from "@sidioralabs/rex";

const REGIONS = ["main"];

export default page("dynamic", {
  route: "/dynamic",
  regions: REGIONS,
  states: ["loading", "busy", "ready"],
});
