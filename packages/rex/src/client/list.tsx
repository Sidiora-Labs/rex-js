import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { validateName } from "../core/ids.ts";
import { isReservedQueryKey } from "../core/protocol.ts";
import { useActivePage } from "./router.tsx";

export const LIST_PAGE_PARAM = "page";
export const LIST_SIZE_PARAM = "size";
export const DEFAULT_LIST_SIZE = 20;
export const MAX_LIST_SIZE = 100;
export const LIST_MORE_LABEL = "Load more";
export const LIST_EMPTY_TEXT = "Nothing to show";

export interface ListParamNames {
  readonly page: string;
  readonly size: string;
}

export interface ListParams {
  readonly page: number;
  readonly size: number;
}

export interface ListWindow {
  readonly page: number;
  readonly size: number;
  readonly shown: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export interface ListProps<T> {
  readonly name: string;
  readonly items: readonly T[];
  readonly itemKey: (item: T, index: number) => string;
  readonly children: (item: T, index: number) => ReactNode;
  readonly size?: number;
  readonly label?: string;
  readonly empty?: ReactNode;
  readonly moreLabel?: string;
  readonly params?: Partial<ListParamNames>;
}

const POSITIVE_INTEGER = /^[1-9][0-9]*$/;

function checkSize(size: unknown): number {
  if (
    typeof size !== "number" ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_LIST_SIZE
  ) {
    throw new RangeError(
      `Page.List: size must be an integer 1..${MAX_LIST_SIZE}, received ${String(size)}`,
    );
  }
  return size;
}

function checkParamName(name: unknown, role: keyof ListParamNames): string {
  if (typeof name !== "string" || !/^[a-z][a-zA-Z0-9-]*$/.test(name)) {
    throw new TypeError(
      `Page.List: the ${role} param must be a lowercase-first query key, received ${String(name)}`,
    );
  }
  if (isReservedQueryKey(name)) {
    throw new TypeError(`Page.List: the ${role} param "${name}" is reserved by Rex`);
  }
  return name;
}

export function listParamNames(params: Partial<ListParamNames> = {}): ListParamNames {
  const names = {
    page: checkParamName(params.page ?? LIST_PAGE_PARAM, "page"),
    size: checkParamName(params.size ?? LIST_SIZE_PARAM, "size"),
  };
  if (names.page === names.size) {
    throw new TypeError(
      `Page.List: the page and size params must differ, both are "${names.page}"`,
    );
  }
  return Object.freeze(names);
}

function positiveInteger(raw: string | null): number | null {
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function readListParams(
  search: string,
  size: number = DEFAULT_LIST_SIZE,
  names: ListParamNames = listParamNames(),
): ListParams {
  const fallback = checkSize(size);
  const query = new URLSearchParams(search);
  const page = positiveInteger(query.get(names.page)) ?? 1;
  const requested = positiveInteger(query.get(names.size));
  return Object.freeze({
    page,
    size: requested === null ? fallback : Math.min(requested, MAX_LIST_SIZE),
  });
}

export function listWindow(total: number, params: ListParams): ListWindow {
  const pages = Math.max(1, Math.ceil(total / params.size));
  const page = Math.min(params.page, pages);
  const shown = Math.min(total, page * params.size);
  return Object.freeze({ page, size: params.size, shown, total, hasMore: shown < total });
}

export function listSearch(search: string, names: ListParamNames, params: ListParams): string {
  const query = new URLSearchParams(search);
  query.set(names.page, String(params.page));
  query.set(names.size, String(params.size));
  return query.toString();
}

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

export function List<T>({
  name,
  items,
  itemKey,
  children,
  size = DEFAULT_LIST_SIZE,
  label,
  empty,
  moreLabel = LIST_MORE_LABEL,
  params,
}: ListProps<T>) {
  const listName = validateName(name, "list name");
  const names = listParamNames(params);
  const active = useActivePage();
  const address = active === null ? listName : `${active.page.id}/${listName}`;
  const [location, navigate] = useLocation();
  const search = useSearch();
  const current = listWindow(items.length, readListParams(search, size, names));
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

  if (typeof itemKey !== "function" || typeof children !== "function") {
    throw new TypeError("Page.List: itemKey and children must be functions of the item");
  }

  const state = {
    "data-rex-list": address,
    "data-rex-list-page": current.page,
    "data-rex-list-size": current.size,
    "data-rex-list-shown": current.shown,
    "data-rex-list-total": current.total,
  };

  if (items.length === 0) {
    return <div {...state}>{empty ?? <p>{LIST_EMPTY_TEXT}</p>}</div>;
  }

  const nextSearch = listSearch(search, names, { page: current.page + 1, size: current.size });
  const href = `${location}?${nextSearch}`;
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
