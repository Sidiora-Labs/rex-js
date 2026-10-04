import { action, always, text } from "@sidioralabs/rex";
import { z } from "zod/mini";
import { recordFeedback } from "../data/feedback.ts";

export const sendFeedback = action("send-feedback", {
  input: z.object({ message: text({ min: 1, max: 500 }) }),
  output: z.object({ received: text({ min: 1 }) }),
  policy: always(),
  effect: "reversible",
  label: "Send feedback",
  form: { redirect: "/about" },
  handler: (input, ctx) => ({ received: recordFeedback(ctx.actor.id, input.message) }),
});
