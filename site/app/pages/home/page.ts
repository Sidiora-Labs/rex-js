import { page } from "@sidioralabs/rex";
import { readHomeMeta } from "../../actions/home/read-home-meta.ts";

export default page("home", {
  route: "/",
  render: "ssg",
  affordances: [
    {
      id: "copy-addresses",
      label: "Copy addresses",
      effect: "read",
      input: { type: "object", properties: {}, additionalProperties: false },
      via: ["click", "palette"],
    },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      effect: "reversible",
      input: { type: "object", properties: {}, additionalProperties: false },
      via: ["click", "palette"],
    },
  ],
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
