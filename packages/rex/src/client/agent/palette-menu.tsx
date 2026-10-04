import { Command } from "cmdk";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { PaletteMenuProps } from "./palette.tsx";

export function PaletteMenu({
  label,
  page,
  actions,
  pages,
  Item,
  valueOf,
  onAction,
  onPage,
  onClose,
}: PaletteMenuProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-rex-palette=""
      onKeyDown={onKeyDown}
    >
      <Command label={label} loop>
        <Command.Input ref={input} placeholder="Search actions and pages" />
        <Command.List>
          <Command.Empty>No matching action or page.</Command.Empty>
          {actions.length === 0 ? null : (
            <Command.Group heading="Actions">
              {actions.map((entry) => (
                <Command.Item
                  key={entry.id}
                  value={valueOf("action", entry.id)}
                  keywords={[entry.label, entry.id]}
                  disabled={!entry.allowed}
                  onSelect={() => onAction(entry)}
                  data-rex-palette-item={page === null ? entry.id : `${page}/${entry.id}`}
                  data-rex-allowed={entry.allowed ? "true" : "false"}
                >
                  <Item
                    kind="action"
                    id={entry.id}
                    label={entry.label}
                    detail={entry.id}
                    shortcut={entry.shortcut}
                    allowed={entry.allowed}
                    reason={entry.reason}
                  />
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Pages">
            {pages.map((entry) => (
              <Command.Item
                key={entry.id}
                value={valueOf("page", entry.id)}
                keywords={[entry.title, entry.id, entry.route]}
                onSelect={() => onPage(entry)}
                data-rex-palette-page={entry.id}
              >
                <Item
                  kind="page"
                  id={entry.id}
                  label={`Go to ${entry.title}`}
                  detail={entry.route}
                  shortcut={null}
                  allowed
                  reason={null}
                />
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
