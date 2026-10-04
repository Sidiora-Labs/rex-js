import { ActionForm, region } from "@sidioralabs/rex/client";
import { sendFeedback } from "../../../../actions/send-feedback.ts";

export default region("feedback", () => (
  <ActionForm action={sendFeedback} submitLabel="Send feedback" />
));
