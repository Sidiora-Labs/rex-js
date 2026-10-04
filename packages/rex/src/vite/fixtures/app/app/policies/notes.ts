import { policy } from "@sidioralabs/rex";

export const notes = policy("notes", {
  permissions: ["notes.write"],
  resolve: (actor) => (actor.permissions.includes("notes.write") ? ["notes.write"] : []),
});
