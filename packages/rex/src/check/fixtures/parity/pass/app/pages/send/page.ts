import { page } from "@sidioralabs/rex";
import { pickToken } from "../../actions/pick-token.ts";
import { send } from "../../actions/send.ts";

export default page("send", {
  route: "/send",
  actions: [send, pickToken],
  regions: ["form", "confirm"],
  overlays: [{ id: "TokenSheet", dismiss: "both", binding: "url" }],
});
