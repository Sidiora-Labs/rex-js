import { useRegistry } from "../context.ts";
import { useText } from "../i18n/context.ts";
import { useNav } from "../nav.ts";
import type { ShellSlotProps } from "./slots.ts";

export const NOT_FOUND_TITLE = "Page not found";

export function HeaderSlot({ active }: ShellSlotProps) {
  const registry = useRegistry();
  const nav = useNav();
  const text = useText();
  const showHeader = active === null || active.chrome.header;
  if (!showHeader) return null;
  const backTarget =
    active === null || active.chrome.back === null
      ? undefined
      : registry.find("page", active.chrome.back);
  return (
    <header>
      <h1>{active === null ? NOT_FOUND_TITLE : text(active.chrome.title)}</h1>
      {backTarget === undefined ? null : (
        <button type="button" data-rex-nav={backTarget.id} onClick={() => nav.back()}>
          Back to {text(backTarget.chrome.title)}
        </button>
      )}
    </header>
  );
}
