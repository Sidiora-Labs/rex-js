import { page } from "@sidioralabs/rex";
import { id } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export default page("item", {
  route: "/items/:id",
  params: z.object({ id: id() }),
  chrome: { title: "Item" },
  regions: ["detail"],
  states: ["loading", "ready"],
});
