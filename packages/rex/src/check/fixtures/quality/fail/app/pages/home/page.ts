import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  regions: ["list"],
  overlays: [{ id: "ContactSheet", binding: "region" }],
});
