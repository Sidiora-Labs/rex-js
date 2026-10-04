import { page, text } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { pickToken } from "../../actions/pick-token.ts";
import { send } from "../../actions/send.ts";
import { wallet } from "../../policies/wallet.ts";

export default page("send", {
  route: "/send/:account",
  params: z.object({ account: text({ min: 1 }), token: text().optional() }),
  policy: wallet.can("send"),
  recovery: "portfolio",
  draft: "route",
  actions: [send, pickToken],
  chrome: { back: "portfolio", nav: false },
  regions: ["form", "confirm"],
  overlays: [{ id: "TokenSelectorSheet", dismiss: "both", binding: "url" }],
});
