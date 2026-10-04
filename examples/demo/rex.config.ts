import { defineConfig } from "@sidioralabs/rex";
import app from "rex:app";
import { createDemoServer } from "./server.ts";

export default defineConfig({
  app,
  ui: "designx",
  server: (bundle) => createDemoServer(bundle),
});
