import { page } from "@sidioralabs/rex";
import { wallet } from "../../policies/wallet.ts";

export default page("portfolio", {
  route: "/",
  policy: wallet.can("view"),
  chrome: { title: "Portfolio" },
  regions: ["hero", "holdings"],
  overlays: [{ id: "HoldingsFilterSheet", dismiss: "both", binding: "url" }],
});
