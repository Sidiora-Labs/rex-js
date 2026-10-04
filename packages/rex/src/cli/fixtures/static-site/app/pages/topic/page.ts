import { page } from "@sidioralabs/rex";
import { text } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export default page("topic", {
  route: "/topics/:slug",
  params: z.object({ slug: text({ min: 1, max: 40 }) }),
  render: "static",
  paths: () => [{ slug: "routing" }, { slug: "forms" }],
  chrome: { title: "Topic" },
  regions: ["body"],
  states: ["loading", "ready"],
});
