import { page } from "@sidioralabs/rex";
import { readHomeMeta } from "../../actions/home/read-home-meta.ts";

export default page("home", {
  route: "/",
  render: "ssg",
  load: { meta: readHomeMeta },
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
