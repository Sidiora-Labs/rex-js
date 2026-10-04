import { useRegistry } from "../context.ts";
import { useText } from "../i18n/context.ts";
import { useNav } from "../nav.ts";
import { useShellComponent } from "./components.ts";
import type { ShellSlotProps } from "./slots.ts";

export const NOT_FOUND_TITLE = "Page not found";

export function HeaderSlot({ active }: ShellSlotProps) {
  const registry = useRegistry();
  const nav = useNav();
  const text = useText();
  const Button = useShellComponent("Button");
  const showHeader = active === null || active.chrome.header;
  if (!showHeader) return null;
  const backTarget =
    active === null || active.chrome.back === null
      ? undefined
      : registry.find("page", active.chrome.back);
  return (
    <div className="rex-page-header">
      <h1 className="rex-page-title">
        {active === null ? NOT_FOUND_TITLE : text(active.chrome.title)}
      </h1>
      {backTarget === undefined ? null : (
        <Button type="button" data-rex-nav={backTarget.id} onClick={() => nav.back()}>
          Back to {text(backTarget.chrome.title)}
        </Button>
      )}
    </div>
  );
}
