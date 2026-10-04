import {
  Fragment,
  createContext,
  createElement,
  use,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from "react";
import { RexError } from "../../core/errors.ts";
import { Page } from "../layout.tsx";
import { useOutcome } from "../outcome.ts";
import type { OutcomeSlotProps } from "./outcome-slot.tsx";
import type { ShellSlotProps } from "./slots.ts";

export const SHELL_COMPONENT_NAMES = [
  "Button",
  "Sheet",
  "PaletteItem",
  "Outcome",
  "Frame",
  "Nav",
] as const;

export type ShellComponentName = (typeof SHELL_COMPONENT_NAMES)[number];

export type ShellButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const SHELL_SHEET_FORMS = ["dialog", "bottom-sheet"] as const;

export type ShellSheetForm = (typeof SHELL_SHEET_FORMS)[number];

export const SHEET_FORM_ATTRIBUTE = "data-rex-sheet-form";

export interface ShellSheetProps {
  readonly address: string;
  readonly title: string;
  readonly titleId: string;
  readonly form: ShellSheetForm;
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

export const NAV_ADDRESS_ATTRIBUTE = "data-rex-nav";
export const PALETTE_TRIGGER_ATTRIBUTE = "data-rex-palette-trigger";
export const SHELL_NAV_FORMS = ["bar", "sidebar", "dock"] as const;

export type ShellNavForm = (typeof SHELL_NAV_FORMS)[number];

export interface ShellNavLink {
  readonly id: string;
  readonly label: string;
  readonly href: string | undefined;
  readonly current: boolean;
  readonly address: string;
  readonly onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface ShellNavProps {
  readonly links: readonly ShellNavLink[];
  readonly form: ShellNavForm;
}

export interface ShellPaletteTriggerProps {
  readonly label: string;
  readonly shortcut: string;
  readonly address: string;
  readonly onOpen: () => void;
}

export interface ShellFrameProps {
  readonly appName: string;
  readonly links: readonly ShellNavLink[];
  readonly navForm: ShellNavForm;
  readonly palette: ShellPaletteTriggerProps | null;
  readonly children?: ReactNode;
}

export interface ShellComponents {
  readonly Button: ComponentType<ShellButtonProps>;
  readonly Sheet: ComponentType<ShellSheetProps>;
  readonly PaletteItem: ComponentType<ShellPaletteItemProps>;
  readonly Outcome: ComponentType<ShellOutcomeProps>;
  readonly Frame: ComponentType<ShellFrameProps>;
  readonly Nav: ComponentType<ShellNavProps>;
}

export type ShellComponentsModule = Readonly<Partial<ShellComponents>>;

export function TokenButton(props: ShellButtonProps) {
  return createElement("button", { type: "button", ...props });
}

export function TokenSheet({ title, titleId, form, children }: ShellSheetProps) {
  return createElement(
    "div",
    { className: "rex-sheet", [SHEET_FORM_ATTRIBUTE]: form },
    form === "bottom-sheet"
      ? createElement("span", { className: "rex-sheet-handle", "aria-hidden": true })
      : null,
    createElement("h2", { id: titleId }, title),
    children,
  );
}

export function TokenPaletteItem({
  label,
  detail,
  shortcut,
  allowed,
  reason,
}: ShellPaletteItemProps) {
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

const SHORTCUT_NAMES: Readonly<Record<string, readonly [apple: string, other: string]>> = {
  mod: ["\u2318", "Ctrl"],
  shift: ["\u21e7", "Shift"],
  alt: ["\u2325", "Alt"],
};

function keyLabel(key: string): string {
  return key.length === 1 ? key.toUpperCase() : `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export function shortcutText(shortcut: string, apple: boolean): string {
  const keys = shortcut.split("+").map((part) => {
    const named = SHORTCUT_NAMES[part];
    if (named !== undefined) return apple ? named[0] : named[1];
    return keyLabel(part);
  });
  return keys.join(apple ? "" : " ");
}

const ARIA_MODIFIERS: Readonly<Record<string, string>> = { shift: "Shift", alt: "Alt" };

export function ariaKeyShortcuts(shortcut: string): string {
  const parts = shortcut.split("+");
  const keyName = keyLabel(parts.at(-1) ?? "");
  const modifiers = parts.slice(0, -1);
  const rest = modifiers
    .filter((part) => part !== "mod")
    .map((part) => ARIA_MODIFIERS[part] ?? part);
  if (!modifiers.includes("mod")) return [...rest, keyName].join("+");
  return ["Control", "Meta"].map((mod) => [mod, ...rest, keyName].join("+")).join(" ");
}

export function isApplePlatform(): boolean {
  const navigator = globalThis.navigator as
    (Navigator & { readonly userAgentData?: { readonly platform?: string } }) | undefined;
  if (navigator === undefined) return false;
  const platform = navigator.userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function subscribePlatform(): () => void {
  return () => {};
}

export function useShortcutText(shortcut: string): string {
  const apple = useSyncExternalStore(subscribePlatform, isApplePlatform, () => false);
  return shortcutText(shortcut, apple);
}

export function TokenNav({ links, form }: ShellNavProps) {
  if (links.length === 0) return null;
  return createElement(
    "nav",
    { "aria-label": "Pages", className: "rex-nav", "data-rex-nav-form": form },
    createElement(
      "ul",
      { className: "rex-nav-list" },
      links.map((link) =>
        createElement(
          "li",
          { key: link.id, className: "rex-nav-item" },
          createElement(
            "a",
            {
              className: "rex-nav-link",
              href: link.href,
              [NAV_ADDRESS_ATTRIBUTE]: link.address,
              "aria-current": link.current ? "page" : undefined,
              onClick: link.onClick,
            },
            link.label,
          ),
        ),
      ),
    ),
  );
}

function SearchIcon() {
  return createElement(
    "svg",
    {
      className: "rex-icon",
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      focusable: false,
    },
    createElement("circle", { cx: 11, cy: 11, r: 7 }),
    createElement("path", { d: "m20 20-3.5-3.5" }),
  );
}

export function TokenPaletteTrigger({
  label,
  shortcut,
  address,
  onOpen,
}: ShellPaletteTriggerProps) {
  const keys = useShortcutText(shortcut);
  return createElement(
    "button",
    {
      type: "button",
      className: "rex-palette-trigger",
      [PALETTE_TRIGGER_ATTRIBUTE]: address,
      "aria-keyshortcuts": ariaKeyShortcuts(shortcut),
      onClick: onOpen,
    },
    createElement(SearchIcon),
    createElement("span", { className: "rex-palette-trigger-label" }, label),
    createElement("kbd", { className: "rex-kbd" }, keys),
  );
}

export function TokenFrame({ appName, links, navForm, palette, children }: ShellFrameProps) {
  const Nav = useShellComponent("Nav");
  const shown = links.length > 0;
  return createElement(
    "div",
    {
      className: "rex-frame",
      "data-rex-frame": "",
      "data-rex-nav-form": shown ? navForm : undefined,
    },
    createElement(
      "header",
      { className: "rex-frame-bar" },
      createElement(
        "div",
        { className: "rex-frame-bar-inner" },
        createElement(
          "span",
          { className: "rex-frame-brand" },
          createElement(
            "span",
            { className: "rex-frame-mark", "aria-hidden": true },
            appName.charAt(0).toUpperCase(),
          ),
          createElement("span", { className: "rex-frame-name" }, appName),
        ),
        navForm === "bar" ? createElement(Nav, { links, form: navForm }) : null,
        palette === null ? null : createElement(TokenPaletteTrigger, palette),
      ),
    ),
    createElement(
      "div",
      { className: "rex-frame-body" },
      navForm === "sidebar" && shown
        ? createElement(
            "div",
            { className: "rex-frame-aside" },
            createElement(Nav, { links, form: navForm }),
          )
        : null,
      createElement("div", { className: "rex-frame-content" }, children),
    ),
    navForm === "dock" ? createElement(Nav, { links, form: navForm }) : null,
  );
}

export const DEFAULT_SHELL_COMPONENTS: ShellComponents = Object.freeze({
  Button: TokenButton,
  Sheet: TokenSheet,
  PaletteItem: TokenPaletteItem,
  Outcome: TokenOutcome,
  Frame: TokenFrame,
  Nav: TokenNav,
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
