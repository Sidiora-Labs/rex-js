import { page } from "@sidioralabs/rex";
import { pickContact } from "../../actions/pick-contact.ts";
import { pickToken } from "../../actions/pick-token.ts";
import { send } from "../../actions/send.ts";
import { viewer } from "../../policies/viewer.ts";

export default page("send", {
  route: "/send",
  policy: viewer.can("viewer.read"),
  recovery: "portfolio",
  draft: "route",
  actions: [send, pickToken, pickContact],
  chrome: { title: "Send", back: "portfolio" },
  regions: ["form", "confirm", "success"],
  overlays: [
    { id: "TokenSelectorSheet", dismiss: "both", binding: "region" },
    { id: "ContactPickerSheet", dismiss: "both", binding: "region" },
  ],
});
