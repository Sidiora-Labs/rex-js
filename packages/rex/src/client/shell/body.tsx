import { useText } from "../i18n/context.ts";
import { useNav } from "../nav.ts";
import { PageHost, type PageModuleSet } from "../page.tsx";
import { useShellComponent } from "./components.ts";
import type { ShellSlotProps } from "./slots.ts";

export function BodySlot({ resolution, modules }: ShellSlotProps) {
  if (resolution.kind === "page") {
    const pageModules = modules.get(resolution.page.id) as PageModuleSet;
    return <PageHost modules={pageModules} />;
  }
  return (
    <main data-rex-app-state="not-found">
      <p role="alert">No page matches {resolution.path}.</p>
    </main>
  );
}

export function RecoverySlot({ resolution }: ShellSlotProps) {
  const nav = useNav();
  const text = useText();
  const Button = useShellComponent("Button");
  const recovery =
    resolution.kind === "page" && !resolution.policy.allowed ? resolution.recovery : null;
  if (recovery === null) return null;
  return (
    <p>
      <Button type="button" data-rex-nav={recovery.id} onClick={() => nav.to(recovery)}>
        Go to {text(recovery.chrome.title)}
      </Button>
    </p>
  );
}
