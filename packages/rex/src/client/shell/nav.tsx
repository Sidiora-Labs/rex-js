import { useMemo, type MouseEvent } from "react";
import type { AnyPage } from "../../core/page.ts";
import { useText } from "../i18n/context.ts";
import { useNav } from "../nav.ts";
import type { ShellNavLink } from "./components.ts";

export function useNavLinks(
  active: AnyPage | null,
  navPages: readonly AnyPage[],
): readonly ShellNavLink[] {
  const nav = useNav();
  const text = useText();
  const showNav = active === null || active.chrome.nav;
  return useMemo(() => {
    if (!showNav) return [];
    return navPages.map((target): ShellNavLink => {
      const href = nav.href(target);
      return {
        id: target.id,
        label: text(target.chrome.title),
        href: href.ok ? href.href : undefined,
        current: target === active,
        address: target.id,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          nav.to(target);
        },
      };
    });
  }, [active, nav, navPages, showNav, text]);
}
