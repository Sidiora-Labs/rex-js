import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  states: ["loading", "ready"],
});
