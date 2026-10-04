import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  regions: ["form"],
  overlays: [{ id: "SearchSheet", dismiss: "both", binding: "url" }],
});
