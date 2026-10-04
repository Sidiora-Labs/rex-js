import { useMemo, type ComponentType } from "react";
import { RexError } from "../core/errors.ts";
import type { AnyPage } from "../core/page.ts";
import { validateStandardSync } from "../core/standard.ts";
import { OutcomeRegion } from "./agent/outcome.tsx";
import { PageInvokers } from "./agent/confirm.tsx";
import { PALETTE_LABEL, PALETTE_SHORTCUT, RexPalette } from "./agent/palette.tsx";
import { RexShortcuts } from "./agent/shortcuts.ts";
import { RexSidecar } from "./agent/sidecar.tsx";
import { RexUrlInvoke } from "./agent/url-invoke.ts";
import { useManifest, useRegistry } from "./context.ts";
import type { PageModuleSet } from "./page.tsx";
import { RexProviders } from "./providers.ts";
import { RexRoutes, type RouteResolution } from "./router.tsx";
import { useShellComponent, type ShellPaletteTriggerProps } from "./shell/components.ts";
import { useNavLinks } from "./shell/nav.tsx";
import { ShellOutcome, type OutcomeSlotProps } from "./shell/outcome-slot.tsx";
import { SHELL_SLOTS, type ShellSlot } from "./shell/slots.ts";

export { NOT_FOUND_TITLE } from "./shell/header.tsx";
export { useNavLinks } from "./shell/nav.tsx";
export { ShellOutcome, type OutcomeSlotProps } from "./shell/outcome-slot.tsx";
export { SHELL_SLOTS, type ShellSlot, type ShellSlotProps } from "./shell/slots.ts";

export interface ShellProps {
  readonly pages: readonly PageModuleSet[];
  readonly outcome?: ComponentType<OutcomeSlotProps>;
}

export function isNavigable(declared: AnyPage): boolean {
  return declared.chrome.nav && validateStandardSync(declared.params, {}).issues === undefined;
}

interface FrameProps {
  readonly resolution: RouteResolution;
  readonly modules: ReadonlyMap<string, PageModuleSet>;
  readonly navPages: readonly AnyPage[];
  readonly Outcome: ComponentType<OutcomeSlotProps>;
  readonly slots: readonly ShellSlot[];
}

export const PALETTE_TRIGGER_ADDRESS = "palette";

export function openPalette(): void {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, cancelable: true }),
  );
}

export function paletteTrigger(): ShellPaletteTriggerProps {
  return {
    label: PALETTE_LABEL,
    shortcut: PALETTE_SHORTCUT,
    address: PALETTE_TRIGGER_ADDRESS,
    onOpen: openPalette,
  };
}

function ShellFrame({ resolution, modules, navPages, Outcome, slots }: FrameProps) {
  const active = resolution.kind === "page" ? resolution.page : null;
  const manifest = useManifest();
  const links = useNavLinks(active, navPages);
  const Frame = useShellComponent("Frame");
  const palette = useMemo(() => (Outcome === AgentOutcome ? paletteTrigger() : null), [Outcome]);
  return (
    <div data-rex-shell="">
      <Frame appName={manifest.app.name} links={links} palette={palette}>
        {slots.map(({ id, Component }) => (
          <Component
            key={id}
            resolution={resolution}
            active={active}
            modules={modules}
            navPages={navPages}
            Outcome={Outcome}
          />
        ))}
      </Frame>
    </div>
  );
}

export function Shell({ pages, outcome }: ShellProps) {
  const registry = useRegistry();
  const modules = useMemo(() => {
    const byId = new Map<string, PageModuleSet>();
    for (const set of pages) {
      if (registry.find("page", set.page.id) !== set.page) {
        throw new RexError(
          "REX313",
          `rex: Shell received modules for unregistered page "${set.page.id}"`,
        );
      }
      if (byId.has(set.page.id)) {
        throw new RexError(
          "REX313",
          `rex: Shell received two module sets for page "${set.page.id}"`,
        );
      }
      byId.set(set.page.id, set);
    }
    for (const declared of registry.pages) {
      if (!byId.has(declared.id)) {
        throw new RexError("REX313", `rex: Shell has no module set for page "${declared.id}"`);
      }
    }
    return byId;
  }, [pages, registry]);
  const navPages = useMemo(() => registry.pages.filter(isNavigable), [registry]);
  const Outcome = outcome ?? ShellOutcome;
  return (
    <RexRoutes
      render={(resolution) => (
        <ShellFrame
          resolution={resolution}
          modules={modules}
          navPages={navPages}
          Outcome={Outcome}
          slots={SHELL_SLOTS}
        />
      )}
    />
  );
}

export function AgentOutcome({ page }: OutcomeSlotProps) {
  return (
    <>
      <OutcomeRegion page={page} />
      <RexSidecar />
      <PageInvokers>
        <RexPalette />
        <RexShortcuts />
        <RexUrlInvoke />
      </PageInvokers>
    </>
  );
}

export interface AgentShellProps {
  readonly pages: readonly PageModuleSet[];
}

export function AgentShell({ pages }: AgentShellProps) {
  return (
    <RexProviders>
      <Shell pages={pages} outcome={AgentOutcome} />
    </RexProviders>
  );
}
