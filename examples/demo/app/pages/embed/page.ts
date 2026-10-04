import { page } from "@sidioralabs/rex";
import { listTokens } from "../../actions/list-tokens.ts";

export default page("embed", {
  route: "/embed",
  load: { tokens: listTokens },
  chrome: { title: "msg:embed.title", back: "portfolio" },
  regions: ["widget", "locale"],
});
