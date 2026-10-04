import { policy } from "@sidioralabs/rex";

export const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (actor) => (actor.attributes.unlocked === true ? ["view", "send"] : ["view"]),
});
