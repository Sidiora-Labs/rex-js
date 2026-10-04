import { useEffect, type CSSProperties, type ReactNode } from "react";
import { parseShortcut } from "../../core/action.ts";
import { matchesShortcut } from "../agent/shortcuts.ts";
import { useActivePage } from "../router.tsx";
import { DEVTOOLS_SHORTCUT } from "./env.ts";
import {
  AuditPanel,
  ManifestPanel,
  OutcomesPanel,
  PagePanel,
  QueriesPanel,
  RendersPanel,
  SidecarPanel,
} from "./panels.tsx";
import {
  DEVTOOLS_PANELS,
  useDevtoolsSnapshot,
  useDevtoolsStore,
  type DevtoolsPanel,
  type DevtoolsStore,
} from "./store.ts";

export const DEVTOOLS_TITLE = "Rex devtools";

export const DEVTOOLS_PANEL_TITLES: { readonly [P in DevtoolsPanel]: string } = {
  manifest: "Manifest",
  page: "Page",
  sidecar: "Sidecar",
  outcomes: "Outcomes",
  queries: "Queries",
  renders: "Renders",
  audit: "Audit",
};

const FRAME_STYLE: CSSProperties = {
  position: "fixed",
  insetInlineEnd: "var(--rex-space-4)",
  insetBlockEnd: "var(--rex-space-4)",
  inlineSize: "min(40rem, calc(100vw - 2 * var(--rex-space-4)))",
  maxBlockSize: "60vh",
  overflow: "auto",
  padding: "var(--rex-space-3)",
  borderRadius: "var(--rex-radius-2)",
  border: "1px solid CanvasText",
  background: "Canvas",
  color: "CanvasText",
  zIndex: 2147483000,
};

const TAB_LIST_STYLE: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--rex-space-1)",
};

function tabId(panel: DevtoolsPanel): string {
  return `rex-devtools-tab-${panel}`;
}

function panelId(panel: DevtoolsPanel): string {
  return `rex-devtools-panel-${panel}`;
}

export function useDevtoolsShortcut(store: DevtoolsStore): void {
  useEffect(() => {
    const target = globalThis.window;
    if (target === undefined) return;
    const shortcut = parseShortcut(DEVTOOLS_SHORTCUT);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, shortcut)) return;
      event.preventDefault();
      store.toggle();
    };
    target.addEventListener("keydown", onKeyDown);
    return () => target.removeEventListener("keydown", onKeyDown);
  }, [store]);
}

function OpenDevtools({ store }: { readonly store: DevtoolsStore }) {
  const snapshot = useDevtoolsSnapshot(store);
  const resolution = useActivePage();
  const panel = snapshot.panel;

  let content: ReactNode;
  switch (panel) {
    case "manifest":
      content = <ManifestPanel />;
      break;
    case "page":
      content = <PagePanel resolution={resolution} />;
      break;
    case "sidecar":
      content = <SidecarPanel resolution={resolution} />;
      break;
    case "outcomes":
      content = <OutcomesPanel snapshot={snapshot} />;
      break;
    case "queries":
      content = <QueriesPanel />;
      break;
    case "renders":
      content = <RendersPanel snapshot={snapshot} />;
      break;
    case "audit":
      content = <AuditPanel />;
      break;
  }

  return (
    <aside data-rex-devtools="" aria-label={DEVTOOLS_TITLE} style={FRAME_STYLE}>
      <header>
        <h2>{DEVTOOLS_TITLE}</h2>
        <button type="button" onClick={() => store.setOpen(false)}>
          Close devtools
        </button>
      </header>
      <div role="tablist" aria-label="Devtools panels" style={TAB_LIST_STYLE}>
        {DEVTOOLS_PANELS.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            id={tabId(entry)}
            aria-selected={entry === panel}
            aria-controls={panelId(entry)}
            data-rex-devtools-tab={entry}
            onClick={() => store.showPanel(entry)}
          >
            {DEVTOOLS_PANEL_TITLES[entry]}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={panelId(panel)}
        aria-labelledby={tabId(panel)}
        data-rex-devtools-panel={panel}
      >
        {content}
      </section>
    </aside>
  );
}

export interface RexDevtoolsProps {
  readonly store: DevtoolsStore;
}

export function RexDevtools({ store }: RexDevtoolsProps) {
  useDevtoolsShortcut(store);
  const { open } = useDevtoolsSnapshot(store);
  return open ? <OpenDevtools store={store} /> : null;
}

export function ConnectedDevtools() {
  const store = useDevtoolsStore();
  return store === null ? null : <RexDevtools store={store} />;
}
