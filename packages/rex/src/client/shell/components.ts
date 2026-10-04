import {
  Fragment,
  createContext,
  createElement,
  use,
  useMemo,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  CHROME_COMPONENT_NAMES,
  type AnyPage,
  type ChromeComponentName,
} from "../../core/page.ts";
import { useText } from "../i18n/context.ts";
import { Page } from "../layout.tsx";
import { useOutcome } from "../outcome.ts";
import type { OutcomeSlotProps } from "./outcome-slot.tsx";
import type { ShellSlotProps } from "./slots.ts";

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
  const text = useText();
  return createElement(
    Page.Outcome,
    null,
    outcome === null ? null : createElement("p", null, text(outcome.message)),
  );
}

export const DEFAULT_SHELL_COMPONENTS: ShellComponents = Object.freeze({
  Button: TokenButton,
  Sheet: TokenSheet,
  PaletteItem: TokenPaletteItem,
  Outcome: TokenOutcome,
});

export function resolveShellComponents(
  page: AnyPage | null,
  base: ShellComponents = DEFAULT_SHELL_COMPONENTS,
): ShellComponents {
  const overrides = page?.chrome.components;
  if (overrides === undefined) return base;
  const resolved: Record<ChromeComponentName, unknown> = { ...base };
  for (const name of CHROME_COMPONENT_NAMES) {
    const override = overrides[name];
    if (override !== undefined) resolved[name] = override;
  }
  return Object.freeze(resolved) as unknown as ShellComponents;
}

export const ShellComponentsContext = createContext<ShellComponents>(DEFAULT_SHELL_COMPONENTS);

export function useShellComponents(): ShellComponents {
  return use(ShellComponentsContext);
}

export function useShellComponent<Name extends ChromeComponentName>(
  name: Name,
): ShellComponents[Name] {
  return useShellComponents()[name];
}

export interface ShellComponentsProviderProps {
  readonly page: AnyPage | null;
  readonly children?: ReactNode;
}

export function ShellComponentsProvider({ page, children }: ShellComponentsProviderProps) {
  const base = use(ShellComponentsContext);
  const value = useMemo(() => resolveShellComponents(page, base), [page, base]);
  return createElement(ShellComponentsContext, { value }, children);
}

export function withShellComponents(
  Slot: ComponentType<ShellSlotProps>,
): ComponentType<ShellSlotProps> {
  function ShellComponentsSlot(props: ShellSlotProps) {
    return createElement(ShellComponentsProvider, { page: props.active }, createElement(Slot, props));
  }
  ShellComponentsSlot.displayName = `ShellComponents(${Slot.displayName ?? Slot.name})`;
  return ShellComponentsSlot;
}
