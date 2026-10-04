import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { ConfirmPending } from "./confirm.tsx";

function describeInput(input: unknown): string {
  try {
    return JSON.stringify(input) ?? "";
  } catch {
    return String(input);
  }
}

export interface ConfirmDialogProps {
  readonly pending: ConfirmPending;
  readonly address: string;
  readonly settle: (accepted: boolean) => void;
}

export function ConfirmDialog({ pending, address, settle }: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const accept = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const { request } = pending;
  const label = request.action.label ?? request.action.id;

  useLayoutEffect(() => {
    accept.current?.focus();
  }, [pending]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      settle(false);
      return;
    }
    if (event.key !== "Tab" || dialog.current === null) return;
    const buttons = [...dialog.current.querySelectorAll("button")];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-rex-confirm={address}
      onKeyDown={onKeyDown}
    >
      <h2 id={titleId}>Confirm {label}</h2>
      <p id={bodyId}>
        {label} cannot be undone. Input: <code>{describeInput(request.input)}</code>
      </p>
      <button
        type="button"
        ref={accept}
        data-rex-confirm-accept={address}
        onClick={() => settle(true)}
      >
        Confirm {label}
      </button>
      <button type="button" data-rex-confirm-cancel={address} onClick={() => settle(false)}>
        Cancel
      </button>
    </div>
  );
}

