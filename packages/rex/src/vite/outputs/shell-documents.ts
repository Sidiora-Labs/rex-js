import { join } from "node:path";
import { writeShellDocuments } from "../prerender.ts";
import type { StaticOutput } from "../outputs.ts";
import { RexError } from "../../core/errors.ts";

export const shellDocumentsOutput: StaticOutput = {
  id: "shell-documents",
  applies: (target) => target === "static",
  write(context) {
    if (context.shell === null) {
      throw new RexError("REX400", "shell-documents: the static target needs the built index.html");
    }
    return writeShellDocuments(
      context.clientDir,
      context.shell,
      context.manifest,
      context.prerendered,
    ).map((entry) => ({
      file: join(context.clientDir, entry.file),
      path: entry.path,
      page: entry.page,
      note:
        entry.page === null
          ? "the shell document for unknown routes"
          : `${entry.page}, the shell document for ${entry.path}`,
    }));
  },
};
