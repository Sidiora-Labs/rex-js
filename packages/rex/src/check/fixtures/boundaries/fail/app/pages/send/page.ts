import { page } from "@sidioralabs/rex";
import { createElement } from "react";
import { send } from "../../actions/send.ts";

export default page("send", {
  route: "/send",
  actions: [send],
  regions: ["form", "confirm"],
  chrome: { title: typeof createElement },
});
