import { lazyModule, useLazyModule } from "./lazy.ts";

type FallbackModule = typeof import("./fallbacks.tsx");

const fallbacks = lazyModule<FallbackModule>(
  "rex.fallbacks",
  "the error and not-found renderers",
  () => import("./fallbacks.tsx"),
);

export function useFallback<Name extends keyof FallbackModule>(
  name: Name,
  outcome?: string,
): FallbackModule[Name] | null {
  const loaded = useLazyModule(fallbacks, outcome === undefined ? {} : { outcome });
  return loaded !== null && loaded.ok ? loaded.value[name] : null;
}
