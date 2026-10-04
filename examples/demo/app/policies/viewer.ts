import { policy } from "@sidioralabs/rex";

export const viewer = policy("viewer", {
  permissions: ["viewer.read"],
  resolve: (actor) => (actor.permissions.includes("viewer.read") ? ["viewer.read"] : []),
});
