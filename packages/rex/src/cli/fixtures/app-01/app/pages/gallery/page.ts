import { page } from "@sidioralabs/rex";

export default page("gallery", {
  route: "/gallery",
  regions: ["cover"],
  states: ["loading", "ready"],
});
