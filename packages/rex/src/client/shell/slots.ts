import type { ComponentType } from "react";
import type { AnyPage } from "../../core/page.ts";
import type { PageModuleSet } from "../page.tsx";
import type { RouteResolution } from "../router.tsx";
import { AnnouncerSlot } from "./announcer.tsx";
import { BodySlot, RecoverySlot } from "./body.tsx";
import { withShellComponents } from "./components.ts";
import { DevtoolsSlot } from "./devtools-slot.tsx";
import { HeaderSlot } from "./header.tsx";
import { NavSlot } from "./nav.tsx";
import { OutcomeSlot, type OutcomeSlotProps } from "./outcome-slot.tsx";

export interface ShellSlotProps {
  readonly resolution: RouteResolution;
  readonly active: AnyPage | null;
  readonly modules: ReadonlyMap<string, PageModuleSet>;
  readonly navPages: readonly AnyPage[];
  readonly Outcome: ComponentType<OutcomeSlotProps>;
}

export interface ShellSlot {
  readonly id: string;
  readonly Component: ComponentType<ShellSlotProps>;
}

export const SHELL_SLOTS: readonly ShellSlot[] = [
  { id: "header", Component: withShellComponents(HeaderSlot) },
  { id: "nav", Component: withShellComponents(NavSlot) },
  { id: "body", Component: withShellComponents(BodySlot) },
  { id: "recovery", Component: withShellComponents(RecoverySlot) },
  { id: "outcome", Component: withShellComponents(OutcomeSlot) },
  { id: "announcer", Component: withShellComponents(AnnouncerSlot) },
  ...(import.meta.env.DEV && import.meta.env.REX_DEVTOOLS !== false
    ? [{ id: "devtools", Component: withShellComponents(DevtoolsSlot) }]
    : []),
];
