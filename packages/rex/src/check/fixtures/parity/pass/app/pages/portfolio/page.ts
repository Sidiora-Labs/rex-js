import { page } from "@sidioralabs/rex";

export default page("portfolio", {
  route: "/",
  states: ["loading", "empty", "ready"],
});
