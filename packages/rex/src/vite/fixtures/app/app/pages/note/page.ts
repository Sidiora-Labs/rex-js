import { id, page, z } from "@sidioralabs/rex";

export default page("note", {
  route: "/notes/:noteId",
  params: z.object({ noteId: id() }),
  chrome: { back: "home", nav: false },
  regions: ["detail"],
  states: ["loading", "terminal-error", "ready"],
});
