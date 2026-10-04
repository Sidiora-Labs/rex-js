import { page } from "@sidioralabs/rex";

export default page("shop", {
  route: "/shop",
  regions: ["cart"],
  overlays: [{ id: "Checkout", dismiss: "escape" }],
});
