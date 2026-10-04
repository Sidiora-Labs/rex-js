import { can, page } from "../../../index.ts";
import { text } from "../../../schema/index.ts";
import { z } from "zod/mini";

export default page("second", {
  route: "/second",
  params: z.object({ name: text({ min: 1 }).optional() }),
  policy: can("view"),
  recovery: "home",
  chrome: { title: "Second", back: "basic" },
});
