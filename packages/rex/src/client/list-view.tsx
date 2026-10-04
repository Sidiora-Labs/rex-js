import { useLayoutEffect, useRef, type MouseEvent } from "react";
import type { ListViewProps } from "./list.tsx";

function plainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function ListView<T>({
  address,
  window: current,
  items,
  itemKey,
  children,
  label,
  empty,
  moreLabel,
  href,
  navigate,
}: ListViewProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const focusFrom = useRef<number | null>(null);

  useLayoutEffect(() => {
    const from = focusFrom.current;
    const element = listRef.current;
    if (from === null || element === null) return;
    focusFrom.current = null;
    const target = element.children.item(from);
    if (target instanceof HTMLElement) target.focus();
  }, [current.shown]);

  const state = {
    "data-rex-list": address,
    "data-rex-list-page": current.page,
    "data-rex-list-size": current.size,
    "data-rex-list-shown": current.shown,
    "data-rex-list-total": current.total,
  };

  if (items.length === 0) {
    return <div {...state}>{empty}</div>;
  }

  const loadMore = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!plainPrimaryClick(event)) return;
    event.preventDefault();
    focusFrom.current = current.shown;
    navigate(href);
  };

  return (
    <div {...state}>
      <ul ref={listRef} aria-label={label}>
        {items.slice(0, current.shown).map((item, index) => (
          <li key={itemKey(item, index)} tabIndex={-1}>
            {children(item, index)}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite">
        {`Showing ${current.shown} of ${current.total}`}
      </p>
      {current.hasMore ? (
        <a href={href} data-rex-list-more={address} onClick={loadMore}>
          {moreLabel}
        </a>
      ) : null}
    </div>
  );
}
