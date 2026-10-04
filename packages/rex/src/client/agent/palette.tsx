import { Command } from "cmdk";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AnyAction } from "../../core/action.ts";
import type { AnyPage } from "../../core/page.ts";
import { evaluate } from "../../core/policy.ts";
import { actionLabel } from "../act.ts";
import { useActor, useManifest, useRegistry } from "../context.ts";
import { useNav } from "../nav.ts";
import { useActivePage } from "../router.tsx";
import { isNavigable } from "../shell.tsx";
import { useConfirm, usePageInvokers } from "./confirm.tsx";
import { isModShortcut } from "./shortcuts.ts";
import { useAffordances, type Affordance } from "./sidecar.tsx";

export const PALETTE_LABEL = "Command palette";
export const PALETTE_SHORTCUT = "mod+k";
export const PALETTE_INPUT: Readonly<Record<string, never>> = Object.freeze({});

export interface PaletteActionEntry {
  readonly kind: "action";
  readonly id: string;
  readonly label: string;
  readonly allowed: boolean;
  readonly reason: string | null;
  readonly shortcut: string | null;
  readonly action: AnyAction | null;
  readonly affordance: Affordance | null;
}

export interface PalettePageEntry {
  readonly kind: "page";
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly page: AnyPage;
}

export function paletteValue(kind: "action" | "page", id: string): string {
  return `${kind}:${id}`;
}

function usePaletteEntries(): {
  readonly actions: readonly PaletteActionEntry[];
  readonly pages: readonly PalettePageEntry[];
} {
  const active = useActivePage();
  const subject = useActor();
  const manifest = useManifest();
  const registry = useRegistry();
  const affordances = useAffordances(active === null ? "" : active.page.id);
  const actions = useMemo<PaletteActionEntry[]>(() => {
    if (active === null) return [];
    const declared = active.page.actions.map((entry): PaletteActionEntry => {
      const decision = evaluate(entry.policy, subject);
      return {
        kind: "action",
        id: entry.id,
        label: actionLabel(entry),
        allowed: decision.allowed,
        reason: decision.reason,
        shortcut: entry.shortcut,
        action: entry,
        affordance: null,
      };
    });
    const extra = affordances.map((entry): PaletteActionEntry => ({
      kind: "action",
      id: entry.id,
      label: entry.label,
      allowed: entry.allowed,
      reason: entry.allowed ? null : entry.reason,
      shortcut: null,
      action: null,
      affordance: entry,
    }));
    return [...declared, ...extra];
  }, [active, affordances, subject]);
  const pages = useMemo<PalettePageEntry[]>(() => {
    const entries: PalettePageEntry[] = [];
    for (const listed of manifest.pages) {
      const declared = registry.find("page", listed.id);
      if (declared === undefined || !isNavigable(declared)) continue;
      entries.push({
        kind: "page",
        id: listed.id,
        title: listed.chrome.title,
        route: listed.route,
        page: declared,
      });
    }
    return entries;
  }, [manifest, registry]);
  return { actions, pages };
}

export interface RexPaletteProps {
  readonly defaultOpen?: boolean;
}

export function RexPalette({ defaultOpen = false }: RexPaletteProps) {
  const [open, setOpen] = useState(defaultOpen);
  const opener = useRef<Element | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const invokers = usePageInvokers();
  const confirm = useConfirm();
  const nav = useNav();
  const active = useActivePage();
  const { actions, pages } = usePaletteEntries();

  useEffect(() => {
    const target = globalThis.window;
    if (target === undefined) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !isModShortcut(event, "k")) return;
      event.preventDefault();
      setOpen((current) => {
        if (!current) opener.current = globalThis.document?.activeElement ?? null;
        return !current;
      });
    };
    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      input.current?.focus();
      return;
    }
    const previous = opener.current;
    opener.current = null;
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  const runAction = (entry: PaletteActionEntry) => {
    if (!entry.allowed) return;
    close();
    if (entry.action !== null) {
      void invokers.invoke(entry.action.id, { ...PALETTE_INPUT });
      return;
    }
    const affordance = entry.affordance;
    if (affordance === null) return;
    if (affordance.effect !== "irreversible") {
      void affordance.invoke({ ...PALETTE_INPUT });
      return;
    }
    const pending = active === null ? null : active.page.id;
    const subject = { id: affordance.id, label: affordance.label, effect: affordance.effect };
    void confirm({ page: pending, action: subject, input: PALETTE_INPUT }).then((accepted) =>
      accepted ? affordance.invoke({ ...PALETTE_INPUT }) : undefined,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={PALETTE_LABEL}
      data-rex-palette=""
      onKeyDown={onKeyDown}
    >
      <Command label={PALETTE_LABEL} loop>
        <Command.Input ref={input} placeholder="Search actions and pages" />
        <Command.List>
          <Command.Empty>No matching action or page.</Command.Empty>
          {actions.length === 0 ? null : (
            <Command.Group heading="Actions">
              {actions.map((entry) => (
                <Command.Item
                  key={entry.id}
                  value={paletteValue("action", entry.id)}
                  keywords={[entry.label, entry.id]}
                  disabled={!entry.allowed}
                  onSelect={() => runAction(entry)}
                  data-rex-palette-item={
                    active === null ? entry.id : `${active.page.id}/${entry.id}`
                  }
                  data-rex-allowed={entry.allowed ? "true" : "false"}
                >
                  <span>{entry.label}</span> <code>{entry.id}</code>
                  {entry.shortcut === null ? null : <kbd>{entry.shortcut}</kbd>}
                  {entry.allowed ? null : <span> Not allowed: {entry.reason}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Pages">
            {pages.map((entry) => (
              <Command.Item
                key={entry.id}
                value={paletteValue("page", entry.id)}
                keywords={[entry.title, entry.id, entry.route]}
                onSelect={() => {
                  close();
                  nav.to(entry.page);
                }}
                data-rex-palette-page={entry.id}
              >
                <span>Go to {entry.title}</span> <code>{entry.route}</code>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
