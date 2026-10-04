import { can, page, text, z } from "../../../index.ts";

export default page("second", {
  route: "/second",
  params: z.object({ name: text({ min: 1 }).optional() }),
  policy: can("view"),
  recovery: "home",
  chrome: { title: "Second", back: "basic" },
});
