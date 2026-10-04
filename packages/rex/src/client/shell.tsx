import { useMemo, type ComponentType, type MouseEvent, type ReactNode } from "react";
import type { AnyPage } from "../core/page.ts";
import { ConfirmProvider, PageInvokers } from "./agent/confirm.tsx";
import { OutcomeRegion } from "./agent/outcome.tsx";
import { RexPalette } from "./agent/palette.tsx";
import { RexShortcuts } from "./agent/shortcuts.ts";
import { RexSidecar } from "./agent/sidecar.tsx";
import { RexUrlInvoke } from "./agent/url-invoke.ts";
import { useRegistry } from "./context.ts";
import { Page } from "./layout.tsx";
import { useNav } from "./nav.ts";
import { APP_OUTCOME_KEY, useOutcome } from "./outcome.ts";
import { PageHost, type PageModuleSet } from "./page.tsx";
import { RexRoutes, type RouteResolution } from "./router.tsx";

export interface OutcomeSlotProps {
  readonly page: string;
}

export interface ShellProps {
  readonly pages: readonly PageModuleSet[];
  readonly outcome?: ComponentType<OutcomeSlotProps>;
}

export const NOT_FOUND_TITLE = "Page not found";

export function isNavigable(declared: AnyPage): boolean {
  return declared.chrome.nav && declared.params.safeParse({}).success;
}

export function ShellOutcome({ page }: OutcomeSlotProps) {
  const outcome = useOutcome(page);
  return <Page.Outcome>{outcome === null ? null : <p>{outcome.message}</p>}</Page.Outcome>;
}

interface FrameProps {
  readonly resolution: RouteResolution;
  readonly modules: ReadonlyMap<string, PageModuleSet>;
  readonly navPages: readonly AnyPage[];
  readonly Outcome: ComponentType<OutcomeSlotProps>;
}

function ShellFrame({ resolution, modules, navPages, Outcome }: FrameProps) {
  const registry = useRegistry();
  const nav = useNav();
  const active = resolution.kind === "page" ? resolution.page : null;
  const showHeader = active === null || active.chrome.header;
  const showNav = active === null || active.chrome.nav;
  const backTarget =
    active === null || active.chrome.back === null
      ? undefined
      : registry.find("page", active.chrome.back);
  const recovery =
    resolution.kind === "page" && !resolution.policy.allowed ? resolution.recovery : null;

  const follow = (target: AnyPage) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    nav.to(target);
  };

  let body: ReactNode;
  if (resolution.kind === "page") {
    const pageModules = modules.get(resolution.page.id) as PageModuleSet;
    body = <PageHost modules={pageModules} />;
  } else {
    body = (
      <main data-rex-app-state="not-found">
        <p role="alert">No page matches {resolution.path}.</p>
      </main>
    );
  }

  return (
    <div data-rex-shell="">
      {showHeader ? (
        <header>
          <h1>{active === null ? NOT_FOUND_TITLE : active.chrome.title}</h1>
          {backTarget === undefined ? null : (
            <button type="button" data-rex-nav={backTarget.id} onClick={() => nav.back()}>
              Back to {backTarget.chrome.title}
            </button>
          )}
        </header>
      ) : null}
      {showNav ? (
        <nav aria-label="Pages">
          <ul>
            {navPages.map((target) => {
              const href = nav.href(target);
              return (
                <li key={target.id}>
                  <a
                    href={href.ok ? href.href : undefined}
                    data-rex-nav={target.id}
                    aria-current={target === active ? "page" : undefined}
                    onClick={follow(target)}
                  >
                    {target.chrome.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {body}
      {recovery === null ? null : (
        <p>
          <button type="button" data-rex-nav={recovery.id} onClick={() => nav.to(recovery)}>
            Go to {recovery.chrome.title}
          </button>
        </p>
      )}
      <Outcome page={active === null ? APP_OUTCOME_KEY : active.id} />
    </div>
  );
}

export function Shell({ pages, outcome }: ShellProps) {
  const registry = useRegistry();
  const modules = useMemo(() => {
    const byId = new Map<string, PageModuleSet>();
    for (const set of pages) {
      if (registry.find("page", set.page.id) !== set.page) {
        throw new Error(`rex: Shell received modules for unregistered page "${set.page.id}"`);
      }
      if (byId.has(set.page.id)) {
        throw new Error(`rex: Shell received two module sets for page "${set.page.id}"`);
      }
      byId.set(set.page.id, set);
    }
    for (const declared of registry.pages) {
      if (!byId.has(declared.id)) {
        throw new Error(`rex: Shell has no module set for page "${declared.id}"`);
      }
    }
    return byId;
  }, [pages, registry]);
  const navPages = useMemo(() => registry.pages.filter(isNavigable), [registry]);
  const Outcome = outcome ?? ShellOutcome;
  return (
    <RexRoutes
      render={(resolution) => (
        <ShellFrame resolution={resolution} modules={modules} navPages={navPages} Outcome={Outcome} />
      )}
    />
  );
}

export function AgentOutcome({ page }: OutcomeSlotProps) {
  return (
    <>
      <OutcomeRegion page={page} />
      <RexSidecar />
      <PageInvokers>
        <RexPalette />
        <RexShortcuts />
        <RexUrlInvoke />
      </PageInvokers>
    </>
  );
}

export interface AgentShellProps {
  readonly pages: readonly PageModuleSet[];
}

export function AgentShell({ pages }: AgentShellProps) {
  return (
    <ConfirmProvider>
      <Shell pages={pages} outcome={AgentOutcome} />
    </ConfirmProvider>
  );
}
