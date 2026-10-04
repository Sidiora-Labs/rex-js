import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { AnyAction } from "../../core/action.ts";
import type { AnyPage } from "../../core/page.ts";
import { evaluate } from "../../core/policy.ts";
import { actionLabel, inputProblem } from "../act.ts";
import { useActor, useManifest, useRegistry } from "../context.ts";
import { useText } from "../i18n/context.ts";
import { APP_OUTCOME_KEY, useOutcomeStore } from "../outcome.ts";
import { useNav } from "../nav.ts";
import { useActivePage } from "../router.tsx";
import { isNavigable } from "../shell.tsx";
import { lazyModule, useLazyModule } from "../lazy.ts";
import { useShellComponents, type ShellPaletteItemProps } from "../shell/components.ts";
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

export interface PaletteMenuProps {
  readonly label: string;
  readonly page: string | null;
  readonly actions: readonly PaletteActionEntry[];
  readonly pages: readonly PalettePageEntry[];
  readonly Item: ComponentType<ShellPaletteItemProps>;
  readonly valueOf: typeof paletteValue;
  onAction(entry: PaletteActionEntry): void;
  onPage(entry: PalettePageEntry): void;
  onClose(): void;
}

const paletteMenu = lazyModule("rex.palette", "the command palette", () =>
  import("./palette-menu.tsx").then((loaded) => loaded.PaletteMenu),
);

function usePaletteEntries(): {
  readonly actions: readonly PaletteActionEntry[];
  readonly pages: readonly PalettePageEntry[];
} {
  const active = useActivePage();
  const subject = useActor();
  const manifest = useManifest();
  const registry = useRegistry();
  const text = useText();
  const affordances = useAffordances(active === null ? "" : active.page.id);
  const actions = useMemo<PaletteActionEntry[]>(() => {
    if (active === null) return [];
    const declared = active.page.actions.map((entry): PaletteActionEntry => {
      const decision = evaluate(entry.policy, subject);
      return {
        kind: "action",
        id: entry.id,
        label: text(actionLabel(entry)),
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
      label: text(entry.label),
      allowed: entry.allowed,
      reason: entry.allowed ? null : entry.reason,
      shortcut: null,
      action: null,
      affordance: entry,
    }));
    return [...declared, ...extra];
  }, [active, affordances, subject, text]);
  const pages = useMemo<PalettePageEntry[]>(() => {
    const entries: PalettePageEntry[] = [];
    for (const listed of manifest.pages) {
      const declared = registry.find("page", listed.id);
      if (declared === undefined || !isNavigable(declared)) continue;
      entries.push({
        kind: "page",
        id: listed.id,
        title: text(listed.chrome.title),
        route: listed.route,
        page: declared,
      });
    }
    return entries;
  }, [manifest, registry, text]);
  return { actions, pages };
}

export interface RexPaletteProps {
  readonly defaultOpen?: boolean;
}

export function RexPalette({ defaultOpen = false }: RexPaletteProps) {
  const [open, setOpen] = useState(defaultOpen);
  const loaded = useLazyModule(paletteMenu, { active: open, suspend: "never" });
  const opener = useRef<Element | null>(null);
  const invokers = usePageInvokers();
  const outcomes = useOutcomeStore();
  const confirm = useConfirm();
  const nav = useNav();
  const active = useActivePage();
  const { actions, pages } = usePaletteEntries();
  const { PaletteItem } = useShellComponents();

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
    if (open) return;
    const previous = opener.current;
    opener.current = null;
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  if (!open || loaded === null || !loaded.ok) return null;
  const Menu = loaded.value;

  const pageId = active === null ? null : active.page.id;

  const runAction = (entry: PaletteActionEntry) => {
    if (!entry.allowed) return;
    close();
    const declared = entry.action;
    if (declared !== null) {
      void inputProblem(declared, PALETTE_INPUT).then((problem) => {
        if (problem === null) {
          void invokers.invoke(declared.id, { ...PALETTE_INPUT });
          return;
        }
        outcomes.set(pageId ?? APP_OUTCOME_KEY, {
          actionId: declared.id,
          ok: false,
          message: problem,
          at: new Date().toISOString(),
        });
      });
      return;
    }
    const affordance = entry.affordance;
    if (affordance === null) return;
    if (affordance.effect !== "irreversible") {
      void affordance.invoke({ ...PALETTE_INPUT });
      return;
    }
    const subject = { id: affordance.id, label: entry.label, effect: affordance.effect };
    void confirm({ page: pageId, action: subject, input: PALETTE_INPUT }).then((accepted) =>
      accepted ? affordance.invoke({ ...PALETTE_INPUT }) : undefined,
    );
  };

  const goTo = (entry: PalettePageEntry) => {
    close();
    nav.to(entry.page);
  };

  return (
    <Menu
      label={PALETTE_LABEL}
      page={pageId}
      actions={actions}
      pages={pages}
      Item={PaletteItem}
      valueOf={paletteValue}
      onAction={runAction}
      onPage={goTo}
      onClose={close}
    />
  );
}
