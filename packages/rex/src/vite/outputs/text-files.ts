import { join } from "node:path";
import { prerenderedTextFile } from "../prerender.ts";
import type { StaticOutput } from "../outputs.ts";

export const textFilesOutput: StaticOutput = {
  id: "text-files",
  applies: (target) => target === "static",
  write: (context) =>
    context.prerendered.pages.map((entry) => ({
      file: join(context.clientDir, prerenderedTextFile(entry.path)),
      path: entry.path,
      page: entry.page,
      note: null,
    })),
};
