import { REX_MANIFEST_PATH } from "../../core/protocol.ts";
import { stableStringify } from "../../manifest/build.ts";
import { writeStaticManifest } from "../prerender.ts";
import type { StaticOutput } from "../outputs.ts";

export const staticManifestOutput: StaticOutput = {
  id: "static-manifest",
  applies: (target) => target === "static",
  write: (context) => [
    {
      file: writeStaticManifest(context.clientDir, stableStringify(context.manifest)),
      path: REX_MANIFEST_PATH,
      page: null,
      note: null,
    },
  ],
};
