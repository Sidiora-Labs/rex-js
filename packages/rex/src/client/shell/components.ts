import {
  Fragment,
  createContext,
  createElement,
  use,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import { RexError } from "../../core/errors.ts";
import { Page } from "../layout.tsx";
import { useOutcome } from "../outcome.ts";
import type { OutcomeSlotProps } from "./outcome-slot.tsx";
import type { ShellSlotProps } from "./slots.ts";

export const SHELL_COMPONENT_NAMES = ["Button", "Sheet", "PaletteItem", "Outcome"] as const;

export type ShellComponentName = (typeof SHELL_COMPONENT_NAMES)[number];

export type ShellButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export interface ShellSheetProps {
  readonly address: string;
  readonly title: string;
  readonly titleId: string;
  readonly children?: ReactNode;
}

export interface ShellPaletteItemProps {
  readonly kind: "action" | "page";
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly shortcut: string | null;
  readonly allowed: boolean;
  readonly reason: string | null;
}

export type ShellOutcomeProps = OutcomeSlotProps;

export interface ShellComponents {
  readonly Button: ComponentType<ShellButtonProps>;
  readonly Sheet: ComponentType<ShellSheetProps>;
  readonly PaletteItem: ComponentType<ShellPaletteItemProps>;
  readonly Outcome: ComponentType<ShellOutcomeProps>;
}

export type ShellComponentsModule = Readonly<Partial<ShellComponents>>;

export function TokenButton(props: ShellButtonProps) {
  return createElement("button", { type: "button", ...props });
}

export function TokenSheet({ title, titleId, children }: ShellSheetProps) {
  return createElement(Fragment, null, createElement("h2", { id: titleId }, title), children);
}

export function TokenPaletteItem({ label, detail, shortcut, allowed, reason }: ShellPaletteItemProps) {
  return createElement(
    Fragment,
    null,
    createElement("span", null, label),
    " ",
    createElement("code", null, detail),
    shortcut === null ? null : createElement("kbd", null, shortcut),
    allowed ? null : createElement("span", null, ` Not allowed: ${reason ?? ""}`),
  );
}

export function TokenOutcome({ page }: ShellOutcomeProps) {
  const outcome = useOutcome(page);
  return createElement(
    Page.Outcome,
    null,
    outcome === null ? null : createElement("p", null, outcome.message),
  );
}

export const DEFAULT_SHELL_COMPONENTS: ShellComponents = Object.freeze({
  Button: TokenButton,
  Sheet: TokenSheet,
  PaletteItem: TokenPaletteItem,
  Outcome: TokenOutcome,
});

function isComponent(value: unknown): boolean {
  if (typeof value === "function") return true;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $$typeof?: unknown }).$$typeof === "symbol"
  );
}

export function resolveShellComponents(
  module: unknown,
  base: ShellComponents = DEFAULT_SHELL_COMPONENTS,
): ShellComponents {
  if ((typeof module !== "object" && typeof module !== "function") || module === null) {
    throw new RexError(
      "REX120",
      `rex.config.ts: field "ui.components" must name a module exporting ${SHELL_COMPONENT_NAMES.join(", ")}`,
    );
  }
  const exported = module as Readonly<Record<string, unknown>>;
  const resolved: Record<ShellComponentName, unknown> = { ...base };
  let found = 0;
  for (const name of SHELL_COMPONENT_NAMES) {
    const component = exported[name];
    if (component === undefined) continue;
    if (!isComponent(component)) {
      throw new RexError(
        "REX120",
        `rex.config.ts: field "ui.components" module export ${name} must be a component`,
      );
    }
    resolved[name] = component;
    found += 1;
  }
  if (found === 0) {
    throw new RexError(
      "REX120",
      `rex.config.ts: field "ui.components" module exports none of ${SHELL_COMPONENT_NAMES.join(", ")}`,
    );
  }
  return Object.freeze(resolved) as unknown as ShellComponents;
}

let appShellComponents: ShellComponents = DEFAULT_SHELL_COMPONENTS;

export function registerShellComponents(module: unknown): () => void {
  const resolved = resolveShellComponents(module);
  appShellComponents = resolved;
  return () => {
    if (appShellComponents === resolved) appShellComponents = DEFAULT_SHELL_COMPONENTS;
  };
}

export const ShellComponentsContext = createContext<ShellComponents | null>(null);

export function useShellComponents(): ShellComponents {
  return use(ShellComponentsContext) ?? appShellComponents;
}

export function useShellComponent<Name extends ShellComponentName>(
  name: Name,
): ShellComponents[Name] {
  return useShellComponents()[name];
}

export function isDefaultShellComponent<Name extends ShellComponentName>(
  name: Name,
  component: ShellComponents[Name],
): boolean {
  return DEFAULT_SHELL_COMPONENTS[name] === component;
}

export interface ShellComponentsProviderProps {
  readonly components: ShellComponents;
  readonly children?: ReactNode;
}

export function ShellComponentsProvider({ components, children }: ShellComponentsProviderProps) {
  return createElement(ShellComponentsContext, { value: components }, children);
}

export function withShellComponents(
  Slot: ComponentType<ShellSlotProps>,
): ComponentType<ShellSlotProps> {
  return Slot;
}
