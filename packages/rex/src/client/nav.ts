import { useCallback, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { RexError } from "../core/errors.ts";
import type { AnyPage, PageDraft, PageParamsInput } from "../core/page.ts";
import {
  validateStandardSync,
  type StandardInferOutput,
  type StandardSchemaV1,
} from "../core/standard.ts";
import { useManifest, useRegistry } from "./context.ts";
import {
  DRAFT_QUERY_KEY,
  manifestParamsSchema,
  pageHref,
  paramKeyAccepted,
  useActivePage,
  useLocaleHref,
  useRouteChange,
  type ParamIssue,
} from "./router.tsx";

export type NavParamsArg<Pg extends AnyPage> =
  {} extends PageParamsInput<Pg> ? [params?: PageParamsInput<Pg>] : [params: PageParamsInput<Pg>];

export type NavOutcome =
  | { readonly ok: true; readonly page: string; readonly href: string }
  | {
      readonly ok: false;
      readonly page: string | null;
      readonly message: string;
      readonly issues: readonly ParamIssue[];
    };

export interface Nav {
  to<Pg extends AnyPage>(page: Pg, ...params: NavParamsArg<Pg>): NavOutcome;
  replace<Pg extends AnyPage>(page: Pg, ...params: NavParamsArg<Pg>): NavOutcome;
  href<Pg extends AnyPage>(page: Pg, ...params: NavParamsArg<Pg>): NavOutcome;
  back(): NavOutcome;
}

function failure(
  page: string | null,
  message: string,
  issues: readonly ParamIssue[] = [],
): NavOutcome {
  return { ok: false, page, message, issues };
}

function describeIssues(page: string, issues: readonly ParamIssue[]): string {
  return `invalid params for page "${page}": ${issues
    .map((issue) => `${issue.path} ${issue.message}`)
    .join("; ")}`;
}

export function useNav(): Nav {
  const registry = useRegistry();
  const manifest = useManifest();
  const active = useActivePage();
  const change = useRouteChange();
  const localize = useLocaleHref();

  const hrefFor = useCallback(
    (target: AnyPage, params: unknown): NavOutcome => {
      if (registry.find("page", target.id) !== target) {
        return failure(target.id, `page "${target.id}" is not registered in this app`);
      }
      const result = pageHref(target, params ?? {}, {}, manifestParamsSchema(manifest, target));
      if (!result.ok) {
        return failure(target.id, describeIssues(target.id, result.issues), result.issues);
      }
      return { ok: true, page: target.id, href: localize(result.href) };
    },
    [localize, manifest, registry],
  );

  return useMemo<Nav>(() => {
    const go = (target: AnyPage, params: unknown, replace: boolean): NavOutcome => {
      const outcome = hrefFor(target, params);
      if (outcome.ok) change(target, outcome.href, { replace });
      return outcome;
    };
    return {
      to: (target, ...params) => go(target, params[0], false),
      replace: (target, ...params) => go(target, params[0], true),
      href: (target, ...params) => hrefFor(target, params[0]),
      back: () => {
        if (active === null) return failure(null, "no page is active");
        const backId = active.page.chrome.back;
        if (backId === null) {
          return failure(active.page.id, `page "${active.page.id}" declares no back target`);
        }
        const target = registry.find("page", backId);
        if (target === undefined) {
          return failure(backId, `back target "${backId}" is not registered in this app`);
        }
        const targetParams = manifestParamsSchema(manifest, target);
        const carried: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(active.params)) {
          if (paramKeyAccepted(targetParams, key)) carried[key] = value;
        }
        return go(target, carried, false);
      },
    };
  }, [active, change, hrefFor, manifest, registry]);
}

export interface Draft<T> {
  readonly mode: PageDraft;
  readonly value: T | null;
  set(value: T | null): void;
}

export function draftStorageKey(page: string): string {
  return `rex:draft:${page}`;
}

function parseDraft<S extends StandardSchemaV1>(
  schema: S,
  raw: string | null,
): StandardInferOutput<S> | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = validateStandardSync(schema, value);
  return parsed.issues === undefined ? parsed.value : null;
}

function readSession(key: string): string | null {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, value);
  } catch {
    return;
  }
}

export function useDraft<S extends StandardSchemaV1>(schema: S): Draft<StandardInferOutput<S>> {
  const active = useActivePage();
  if (active === null)
    throw new RexError("REX306", "rex: useDraft must be called inside an active page");
  const declared = active.page;
  const [location, navigate] = useLocation();
  const search = useSearch();
  const storageKey = draftStorageKey(declared.id);
  const [sessionRaw, setSessionRaw] = useState(() =>
    declared.draft === "session" ? readSession(storageKey) : null,
  );

  const raw =
    declared.draft === "route"
      ? new URLSearchParams(search).get(DRAFT_QUERY_KEY)
      : declared.draft === "session"
        ? sessionRaw
        : null;
  const value = useMemo(() => parseDraft(schema, raw), [schema, raw]);

  const set = useCallback(
    (next: StandardInferOutput<S> | null) => {
      if (next !== null && validateStandardSync(schema, next).issues !== undefined) {
        throw new RexError(
          "REX325",
          `rex: draft for page "${declared.id}" does not match its schema`,
        );
      }
      const encoded = next === null ? null : JSON.stringify(next);
      if (declared.draft === "route") {
        const query = new URLSearchParams(search);
        if (encoded === null) query.delete(DRAFT_QUERY_KEY);
        else query.set(DRAFT_QUERY_KEY, encoded);
        const nextSearch = query.toString();
        navigate(nextSearch === "" ? location : `${location}?${nextSearch}`, { replace: true });
      } else if (declared.draft === "session") {
        writeSession(storageKey, encoded);
        setSessionRaw(encoded);
      } else {
        throw new RexError("REX325", `rex: page "${declared.id}" declares draft "none"`);
      }
    },
    [declared, location, navigate, schema, search, storageKey],
  );

  return { mode: declared.draft, value, set };
}
