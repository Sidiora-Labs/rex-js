import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { OverlaySurfaceProps } from "./overlay.tsx";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
