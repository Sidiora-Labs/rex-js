import { anonymousActor } from "@sidioralabs/rex";
import { createRexServer, memoryLedger } from "@sidioralabs/rex/server";
import app from "rex:app";

export default createRexServer({
  registry: app.registry,
  ledger: memoryLedger(),
  actor: () => anonymousActor,
  app: app.name,
});
