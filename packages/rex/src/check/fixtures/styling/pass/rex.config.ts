import { defineConfig } from "@sidioralabs/rex/config";
import app from "rex:app";

export default defineConfig({
  app,
  tailwind: true,
  check: {
    tokens: {
      colors: ["#1f2937"],
      spacing: ["1px"],
      classes: ["bg-black/50"],
    },
  },
});
