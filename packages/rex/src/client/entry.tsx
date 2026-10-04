import type { ComponentType } from "react";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";
import { DensityProvider } from "./agent/density.ts";
import { createRexApp, type CreateRexAppOptions } from "./app.tsx";
import type { PageModuleSet } from "./page.tsx";
import { RexProviders } from "./providers.ts";
import { AgentOutcome, Shell } from "./shell.tsx";

export interface RexEntryBundle {
  readonly registry: RegistrySnapshot;
  readonly manifest?: Manifest;
  readonly pages: readonly PageModuleSet[];
}

export type RexEntryOptions = Omit<CreateRexAppOptions, "registry" | "manifest" | "density">;

export function createRexEntry(
  bundle: RexEntryBundle,
  options: RexEntryOptions = {},
): ComponentType {
  if (typeof bundle !== "object" || bundle === null || !Array.isArray(bundle.pages)) {
    throw new TypeError("createRexEntry: the rex:app bundle with registry and pages is required");
  }
  const RexApp = createRexApp({
    ...options,
    registry: bundle.registry,
    ...(bundle.manifest === undefined ? {} : { manifest: bundle.manifest }),
    density: DensityProvider,
  });
  const pages = bundle.pages;
  function RexEntry() {
    return (
      <RexApp>
        <RexProviders>
          <Shell pages={pages} outcome={AgentOutcome} />
        </RexProviders>
      </RexApp>
    );
  }
  RexEntry.displayName = "RexEntry";
  return RexEntry;
}
