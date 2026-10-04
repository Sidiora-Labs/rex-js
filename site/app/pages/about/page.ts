import { page } from "@sidioralabs/rex";

export default page("about", {
  route: "/about",
  render: "static",
  chrome: { title: "About", back: "home" },
  regions: ["sidiora", "license", "governance", "contributing", "security"],
});
