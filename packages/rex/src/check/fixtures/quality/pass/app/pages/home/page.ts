import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  regions: ["list"],
  overlays: [{ id: "FilterSheet", dismiss: "both", binding: "url" }],
});
