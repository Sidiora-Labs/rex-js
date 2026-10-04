import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";

export interface RuntimePaths {
  readonly core: string;
  readonly client: string;
}

export function runtimePaths(from: string = import.meta.url): RuntimePaths {
  const extension = from.endsWith(".ts") ? ".ts" : ".js";
  const source = dirname(dirname(fileURLToPath(from)));
  return {
    core: normalizePath(join(source, `index${extension}`)),
    client: normalizePath(join(source, "client", `index${extension}`)),
  };
}

export interface ResolveContext {
  resolve(
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean },
  ): Promise<{ readonly id: string; readonly external?: boolean | "absolute" | "relative" } | null>;
}

export async function resolveRuntimeEntry(
  context: ResolveContext,
  root: string,
  specifier: string,
  fallback: string,
): Promise<string> {
  const resolved = await context.resolve(specifier, join(root, "index.html"), { skipSelf: true });
  if (resolved === null || resolved.external || !isAbsolute(resolved.id)) return fallback;
  return normalizePath(resolved.id);
}
