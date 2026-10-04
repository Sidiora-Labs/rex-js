import { page } from "@sidioralabs/rex";
import { loadWallet } from "../../actions/load-wallet.ts";
import { toggleHideDust } from "../../actions/toggle-hide-dust.ts";
import { viewer } from "../../policies/viewer.ts";

export default page("portfolio", {
  route: "/",
  policy: viewer.can("viewer.read"),
  draft: "route",
  load: { wallet: loadWallet },
  actions: [toggleHideDust],
  chrome: { title: "Portfolio" },
  regions: ["hero", "actions", "holdings"],
  overlays: [{ id: "HoldingsFilterSheet", dismiss: "both", binding: "url" }],
});
