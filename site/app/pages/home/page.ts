import { page } from "@sidioralabs/rex";

export default page("home", {
  route: "/",
  render: "ssg",
  chrome: { title: "Home", header: false },
  regions: [
    "hero",
    "pitch",
    "primitives",
    "how-it-works",
    "install",
    "features",
    "live-sidecar",
    "footer",
  ],
});
