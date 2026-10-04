import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";
import { createDemoServer } from "./server.ts";

export default defineConfig({
  app,
  ui: { kit: "designx", components: "app/components/Shell.tsx" },
  server: (bundle) => createDemoServer(bundle),
});
