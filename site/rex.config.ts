import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";

export default defineConfig({
  app,
  ui: { kit: "designx", components: "app/components/Shell.tsx" },
});
