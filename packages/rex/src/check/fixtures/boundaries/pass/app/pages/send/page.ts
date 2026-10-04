import { page } from "@sidioralabs/rex";
import { send } from "../../actions/send.ts";
import { wallet } from "../../policies/wallet.ts";

export default page("send", {
  route: "/send",
  policy: wallet.can("view"),
  actions: [send],
  regions: ["form"],
  overlays: [{ id: "TokenSheet", dismiss: "both", binding: "url" }],
});
