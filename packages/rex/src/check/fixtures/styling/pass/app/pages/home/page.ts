import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  chrome: { title: "Home" },
  regions: ["cards"],
});
