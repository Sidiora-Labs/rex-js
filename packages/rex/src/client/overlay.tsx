import { useCallback, useLayoutEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { RexError } from "../core/errors.ts";
import { overlayAddress, overlayName } from "../core/ids.ts";
import {
  OVERLAY_BINDINGS,
  OVERLAY_DISMISS,
  type OverlayBinding,
  type OverlayDeclaration,
  type OverlayDismiss,
} from "../core/overlay.ts";
import type { AnyPage } from "../core/page.ts";
import { useOpenOverlays, useOverlayRegistry } from "./agent/sidecar.tsx";
import { lazyModule, useLazyModule } from "./lazy.ts";
import { useActivePage } from "./router.tsx";
import { sheetFormFor, useScreen } from "./screen.ts";
import {
  useShellComponents,
  type ShellComponents,
  type ShellSheetForm,
} from "./shell/components.ts";

export const OVERLAY_QUERY_KEY = "overlay";
export const OVERLAY_DISMISS_LABEL = "Close";
export const OVERLAY_FORM_ATTRIBUTE = "data-rex-overlay-form";

export interface OverlayOptions {
  readonly dismiss: OverlayDismiss;
  readonly binding: OverlayBinding;
}

export interface OverlayRenderContext {
  readonly page: string;
  readonly id: string;
  close(): void;
}

export type OverlayComponent = ComponentType & {
  readonly rexKind: "overlay";
  readonly overlayId: string;
  readonly dismiss: OverlayDismiss;
  readonly binding: OverlayBinding;
};

export function dismissesOnEscape(dismiss: OverlayDismiss): boolean {
  return dismiss === "escape" || dismiss === "both";
}

export function dismissesOnButton(dismiss: OverlayDismiss): boolean {
  return dismiss === "button" || dismiss === "both";
}

export function overlaySentence(id: string): string {
  const words = id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function openOverlaysFromSearch(search: string): readonly string[] {
  return new URLSearchParams(search).getAll(OVERLAY_QUERY_KEY);
}

export function searchWithOverlay(search: string, id: string, open: boolean): string {
  const query = new URLSearchParams(search);
  const current = query.getAll(OVERLAY_QUERY_KEY).filter((entry) => entry !== id);
  query.delete(OVERLAY_QUERY_KEY);
  for (const entry of open ? [...current, id] : current) query.append(OVERLAY_QUERY_KEY, entry);
  return query.toString();
}

function declarationFor(declared: AnyPage, component: OverlayComponent): OverlayDeclaration {
  const found = declared.overlays.find((entry) => entry.id === component.overlayId);
  if (found === undefined) {
    throw new RexError(
      "REX307",
      `rex: overlay "${component.overlayId}" is not declared by page "${declared.id}"`,
    );
  }
  if (found.dismiss !== component.dismiss || found.binding !== component.binding) {
    throw new RexError(
      "REX307",
      `rex: overlay "${component.overlayId}" declares dismiss "${component.dismiss}" and binding "${component.binding}" but page "${declared.id}" declares dismiss "${found.dismiss}" and binding "${found.binding}"`,
    );
  }
  return found;
}

export interface OverlayHandle {
  readonly page: string;
  readonly id: string;
  readonly address: string;
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  readonly triggerProps: {
    readonly "data-rex-overlay-trigger": string;
    readonly "aria-haspopup": "dialog";
    readonly "aria-expanded": boolean;
    readonly onClick: () => void;
  };
}

export function useOverlay(component: OverlayComponent): OverlayHandle {
  const active = useActivePage();
  if (active === null)
    throw new RexError("REX306", "rex: useOverlay must be called inside an active page");
  const declared = declarationFor(active.page, component);
  const pageId = active.page.id;
  const registry = useOverlayRegistry();
  const registryOpen = useOpenOverlays(pageId);
  const [location, navigate] = useLocation();
  const search = useSearch();

  const open =
    declared.binding === "url"
      ? openOverlaysFromSearch(search).includes(declared.id)
      : registryOpen.includes(declared.id);

  const setOpen = useCallback(
    (next: boolean) => {
      if (declared.binding === "url") {
        const nextSearch = searchWithOverlay(search, declared.id, next);
        const target = nextSearch === "" ? location : `${location}?${nextSearch}`;
        navigate(target, { replace: !next });
        return;
      }
      registry.setOpen(pageId, declared.id, next);
    },
    [declared, location, navigate, pageId, registry, search],
  );

  return useMemo<OverlayHandle>(() => {
    const address = overlayAddress(pageId, declared.id);
    return {
      page: pageId,
      id: declared.id,
      address,
      open,
      show: () => setOpen(true),
      hide: () => setOpen(false),
      toggle: () => setOpen(!open),
      triggerProps: {
        "data-rex-overlay-trigger": address,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: () => setOpen(!open),
      },
    };
  }, [declared, open, pageId, setOpen]);
}

export interface OverlaySurfaceProps {
  readonly address: string;
  readonly dismiss: OverlayDismiss;
  readonly title: string;
  readonly form: ShellSheetForm;
  readonly escape: boolean;
  readonly closeLabel: string | null;
  readonly hide: () => void;
  readonly Sheet: ShellComponents["Sheet"];
  readonly Button: ShellComponents["Button"];
  readonly children?: ReactNode;
}

const overlaySurface = lazyModule("rex.overlay-host", "the overlay host", () =>
  import("./overlay-surface.tsx").then((loaded) => loaded.OverlaySurface),
);

interface LazyOverlaySurfaceProps {
  readonly handle: OverlayHandle;
  readonly dismiss: OverlayDismiss;
  readonly children?: ReactNode;
}

function LazyOverlaySurface({ handle, dismiss, children }: LazyOverlaySurfaceProps) {
  const loaded = useLazyModule(overlaySurface, { outcome: handle.page });
  const { Sheet, Button } = useShellComponents();
  const form = sheetFormFor(useScreen().screen);
  if (loaded === null || !loaded.ok) return null;
  const Surface = loaded.value;
  return (
    <Surface
      address={handle.address}
      dismiss={dismiss}
      title={overlaySentence(handle.id)}
      form={form}
      escape={dismissesOnEscape(dismiss)}
      closeLabel={dismissesOnButton(dismiss) ? OVERLAY_DISMISS_LABEL : null}
      hide={handle.hide}
      Sheet={Sheet}
      Button={Button}
    >
      {children}
    </Surface>
  );
}

export function overlay(
  id: string,
  options: OverlayOptions,
  render: (ctx: OverlayRenderContext) => ReactNode,
): OverlayComponent {
  overlayName(id);
  if (typeof options !== "object" || options === null) {
    throw new RexError("REX313", `overlay ${id}: options must declare dismiss and binding`);
  }
  if (!OVERLAY_DISMISS.includes(options.dismiss)) {
    throw new RexError(
      "REX313",
      `overlay ${id}: dismiss must be one of ${OVERLAY_DISMISS.join(", ")}`,
    );
  }
  if (!OVERLAY_BINDINGS.includes(options.binding)) {
    throw new RexError(
      "REX313",
      `overlay ${id}: binding must be one of ${OVERLAY_BINDINGS.join(", ")}`,
    );
  }
  if (typeof render !== "function")
    throw new RexError("REX313", `overlay ${id}: render must be a function`);

  const statics = {
    rexKind: "overlay" as const,
    overlayId: id,
    dismiss: options.dismiss,
    binding: options.binding,
  };

  function RexOverlay() {
    const handle = useOverlay(Component);
    const registry = useOverlayRegistry();
    const { page, open } = handle;

    useLayoutEffect(() => {
      registry.setOpen(page, id, open);
    }, [open, page, registry]);

    useLayoutEffect(
      () => () => {
        registry.setOpen(page, id, false);
      },
      [page, registry],
    );

    if (!open) return null;
    return (
      <LazyOverlaySurface handle={handle} dismiss={options.dismiss}>
        {render({ page, id, close: handle.hide })}
      </LazyOverlaySurface>
    );
  }
  RexOverlay.displayName = `Overlay(${id})`;
  const Component: OverlayComponent = Object.assign(RexOverlay, statics);
  return Component;
}
