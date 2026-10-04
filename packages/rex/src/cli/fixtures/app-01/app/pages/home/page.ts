import { page } from "@sidioralabs/rex";
import { ping } from "../../actions/ping.ts";

export default page("home", {
  route: "/",
  actions: [ping],
  regions: ["welcome"],
});
