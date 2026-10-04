import { page } from "@sidioralabs/rex";
import { sendFeedback } from "../../actions/send-feedback.ts";

export default page("about", {
  route: "/about",
  render: "static",
  actions: [sendFeedback],
  chrome: { title: "msg:about.title", back: "portfolio" },
  regions: ["intro", "feedback"],
});
