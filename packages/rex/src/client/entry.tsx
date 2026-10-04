import { QueryClient } from "@tanstack/react-query";
import { StrictMode, type ComponentType } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { actor as createActor } from "../core/actor.ts";
import { RexError } from "../core/errors.ts";
import type { RegistrySnapshot } from "../core/registry.ts";
import type { Manifest } from "../manifest/types.ts";
import { DensityProvider } from "./agent/density.ts";
import { createRexApp, type CreateRexAppOptions } from "./app.tsx";
import {
  REX_DATA_MIME_TYPE,
  RexDataError,
  hydrateQueries,
  isServerRendered,
  readRexData,
  recoverableErrorHandler,
  type HydrationReporter,
} from "./hydrate.ts";
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
    throw new RexError(
      "REX313",
      "createRexEntry: the rex:app bundle with registry and pages is required",
    );
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

export interface StartRexOptions extends RexEntryOptions {
  readonly dev?: boolean;
  readonly onHydrationMismatch?: HydrationReporter;
}

export interface StartedRex {
  readonly mode: "hydrate" | "render";
  readonly root: Root;
}

export function findRootElement(id: string, document: Document = globalThis.document): Element {
  const element = document.getElementById(id);
  if (element === null) {
    throw new RexError("REX463", `rex: index.html has no element with id "${id}"`);
  }
  return element;
}

export function startRexEntry(
  container: Element,
  bundle: RexEntryBundle,
  options: StartRexOptions = {},
): StartedRex {
  const { dev = false, onHydrationMismatch, ...entryOptions } = options;
  if (!isServerRendered(container)) {
    const RexEntry = createRexEntry(bundle, entryOptions);
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <RexEntry />
      </StrictMode>,
    );
    return { mode: "render", root };
  }
  const data = readRexData(container.ownerDocument);
  if (data === null) {
    throw new RexDataError(
      `the server-rendered root has no ${REX_DATA_MIME_TYPE} script to hydrate from`,
    );
  }
  const queryClient = entryOptions.queryClient ?? new QueryClient();
  hydrateQueries(queryClient, data);
  const RexEntry = createRexEntry(bundle, {
    ...entryOptions,
    actor: createActor(data.actor),
    queryClient,
  });
  const root = hydrateRoot(
    container,
    <StrictMode>
      <RexEntry />
    </StrictMode>,
    {
      onRecoverableError: recoverableErrorHandler(
        onHydrationMismatch === undefined ? { dev } : { dev, report: onHydrationMismatch },
      ),
    },
  );
  return { mode: "hydrate", root };
}
