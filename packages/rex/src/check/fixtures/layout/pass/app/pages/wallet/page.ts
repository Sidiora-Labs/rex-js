import { page } from "@sidioralabs/rex";

export default page("wallet", {
  route: "/wallet",
  regions: ["balance"],
  overlays: [{ id: "Receive", dismiss: "escape" }],
});
