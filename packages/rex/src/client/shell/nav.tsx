import type { MouseEvent } from "react";
import type { AnyPage } from "../../core/page.ts";
import { useText } from "../i18n/context.ts";
import { useNav } from "../nav.ts";
import type { ShellSlotProps } from "./slots.ts";

export function NavSlot({ active, navPages }: ShellSlotProps) {
  const nav = useNav();
  const text = useText();
  const showNav = active === null || active.chrome.nav;
  if (!showNav) return null;

  const follow = (target: AnyPage) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    nav.to(target);
  };

  return (
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
                {text(target.chrome.title)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
