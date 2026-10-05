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
          const anchor = event.currentTarget;
          const browsingTarget = anchor.getAttribute("target");
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            !anchor.hasAttribute("href") ||
            anchor.hasAttribute("download") ||
            (browsingTarget !== null &&
              browsingTarget !== "" &&
              browsingTarget.toLowerCase() !== "_self") ||
            anchor.origin !== anchor.ownerDocument.location.origin
          ) {
            return;
          }
          event.preventDefault();
          nav.to(target);
        },
      };
    });
  }, [active, nav, navPages, showNav, text]);
}
