import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { OverlaySurfaceProps } from "./overlay.tsx";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (
      element.matches(
        'input[type="hidden"], button[disabled], input[disabled], select[disabled], textarea[disabled]',
      ) ||
      element.tabIndex < 0
    )
      return false;
    const view = element.ownerDocument.defaultView;
    for (
      let ancestor: HTMLElement | null = element;
      ancestor !== null;
      ancestor = ancestor.parentElement
    ) {
      if (ancestor.hasAttribute("hidden") || ancestor.hasAttribute("inert")) return false;
      const style = view?.getComputedStyle(ancestor);
      if (
        style?.display === "none" ||
        style?.visibility === "hidden" ||
        style?.visibility === "collapse"
      )
        return false;
      if (ancestor.matches("fieldset[disabled]")) {
        const legend = [...ancestor.children].find((child) => child.tagName === "LEGEND");
        if (legend === undefined || !legend.contains(element)) return false;
      }
    }
    return true;
  });
}

export function OverlaySurface({
  address,
  dismiss,
  title,
  form,
  escape,
  closeLabel,
  hide,
  Sheet,
  Button,
  children,
}: OverlaySurfaceProps) {
  const surface = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = surface.current;
    if (element === null) return;
    const opener = globalThis.document?.activeElement ?? null;
    const first = focusables(element)[0];
    (first ?? element).focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!escape) return;
      event.preventDefault();
      event.stopPropagation();
      hide();
      return;
    }
    if (event.key !== "Tab" || surface.current === null) return;
    const items = focusables(surface.current);
    const first = items[0];
    const last = items.at(-1);
    if (first === undefined || last === undefined) {
      event.preventDefault();
      surface.current.focus();
      return;
    }
    const current = globalThis.document?.activeElement;
    if (event.shiftKey && (current === first || current === surface.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={surface}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-rex-overlay={address}
      data-rex-overlay-dismiss={dismiss}
      data-rex-overlay-form={form}
      onKeyDown={onKeyDown}
    >
      <Sheet address={address} title={title} titleId={titleId} form={form}>
        {children}
      </Sheet>
      {closeLabel === null ? null : (
        <Button type="button" data-rex-overlay-close={address} onClick={hide}>
          {closeLabel}
        </Button>
      )}
    </div>
  );
}
