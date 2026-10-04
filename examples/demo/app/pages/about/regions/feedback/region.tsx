import { ActionForm, region } from "@sidioralabs/rex/client";
import { sendFeedback } from "../../../../actions/send-feedback.ts";
import Card from "../../../../components/Card.tsx";

export default region("feedback", () => (
  <Card title="Feedback" description="Tell the Rex team what works and what does not.">
    <ActionForm action={sendFeedback} submitLabel="Send feedback" />
  </Card>
));
