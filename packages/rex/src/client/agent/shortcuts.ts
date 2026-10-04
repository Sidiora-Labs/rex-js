import { useEffect } from "react";
import { parseShortcut, type AnyAction, type ParsedShortcut } from "../../core/action.ts";
import { useActivePage } from "../router.tsx";
import { usePageInvokers } from "./confirm.tsx";

export interface ShortcutEventLike {
  readonly key: string;
  readonly code?: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  " ": "space",
  spacebar: "space",
  esc: "escape",
  del: "delete",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
};

export function eventKeys(event: ShortcutEventLike): readonly string[] {
  const keys = new Set<string>();
  const key = event.key.toLowerCase();
  keys.add(KEY_ALIASES[key] ?? key);
  const code = event.code ?? "";
  if (/^Key[A-Z]$/.test(code)) keys.add(code.slice(3).toLowerCase());
  else if (/^Digit[0-9]$/.test(code)) keys.add(code.slice(5));
  return [...keys];
}

export function matchesShortcut(event: ShortcutEventLike, shortcut: ParsedShortcut): boolean {
  const mod = event.metaKey || event.ctrlKey;
  if (mod !== shortcut.mod || event.altKey !== shortcut.alt || event.shiftKey !== shortcut.shift) {
    return false;
  }
  return eventKeys(event).includes(shortcut.key);
}

export function isModShortcut(event: ShortcutEventLike, key: string): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    eventKeys(event).includes(key)
  );
}

export function shortcutAction(
  actions: readonly AnyAction[],
  event: ShortcutEventLike,
): AnyAction | null {
  for (const declared of actions) {
    if (declared.shortcut === null) continue;
    if (matchesShortcut(event, parseShortcut(declared.shortcut))) return declared;
  }
  return null;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function insideModal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[aria-modal="true"]') !== null;
}

export const SHORTCUT_INPUT: Readonly<Record<string, never>> = Object.freeze({});

export function useShortcuts(): void {
  const active = useActivePage();
  const invokers = usePageInvokers();
  const actions = active === null ? null : active.page.actions;

  useEffect(() => {
    const target = globalThis.window;
    if (target === undefined || actions === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || insideModal(event.target)) return;
      const declared = shortcutAction(actions, event);
      if (declared === null) return;
      if (isEditable(event.target) && !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      void invokers.invoke(declared.id, { ...SHORTCUT_INPUT });
    };
    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [actions, invokers]);
}

export function RexShortcuts(): null {
  useShortcuts();
  return null;
}
