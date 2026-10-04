import { useNav } from "../nav.ts";
import { PageHost, type PageModuleSet } from "../page.tsx";
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
  const recovery =
    resolution.kind === "page" && !resolution.policy.allowed ? resolution.recovery : null;
  if (recovery === null) return null;
  return (
    <p>
      <button type="button" data-rex-nav={recovery.id} onClick={() => nav.to(recovery)}>
        Go to {recovery.chrome.title}
      </button>
    </p>
  );
}
