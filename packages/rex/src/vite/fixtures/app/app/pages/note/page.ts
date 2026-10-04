import { page } from "@sidioralabs/rex";
import { id } from "@sidioralabs/rex/schema";
import { z } from "zod/mini";

export default page("note", {
  route: "/notes/:noteId",
  params: z.object({ noteId: id() }),
  chrome: { back: "home", nav: false },
  regions: ["detail"],
  states: ["loading", "terminal-error", "ready"],
});
