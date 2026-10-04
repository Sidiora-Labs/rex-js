import type { AnyAction } from "./action.ts";
import { RexDeclarationError } from "./entity.ts";
import { RexError } from "./errors.ts";
import type { AnyEntity } from "./entity.ts";
import { NOT_FOUND_PAGE_ID, type AnyPage } from "./page.ts";
import type { AnyPolicy } from "./policy.ts";

export interface RegistryKinds {
  entity: AnyEntity;
  action: AnyAction;
  policy: AnyPolicy;
}

export type DeclarationKind = keyof RegistryKinds;

export type AnyDeclaration = RegistryKinds[DeclarationKind];

export const DECLARATION_KINDS = ["entity", "action", "page", "policy", "flow"] as const;

type Plural<K extends string> = K extends "entity"
  ? "entities"
  : K extends "policy"
    ? "policies"
    : `${K}s`;

export type RegistryLists = {
  readonly [K in DeclarationKind as Plural<K>]: readonly RegistryKinds[K][];
};

export type RegistrySnapshot = RegistryLists & {
  find<K extends DeclarationKind>(kind: K, id: string): RegistryKinds[K] | undefined;
  get<K extends DeclarationKind>(kind: K, id: string): RegistryKinds[K];
};

export interface Registry {
  register<const D extends readonly AnyDeclaration[]>(...declarations: D): Registry;
  has(kind: DeclarationKind, id: string): boolean;
  freeze(): RegistrySnapshot;
}

const LIST_NAMES: Record<(typeof DECLARATION_KINDS)[number], string> = {
  entity: "entities",
  action: "actions",
  page: "pages",
  policy: "policies",
  flow: "flows",
};

function isKind(kind: unknown): kind is (typeof DECLARATION_KINDS)[number] {
  return typeof kind === "string" && (DECLARATION_KINDS as readonly string[]).includes(kind);
}

export function compareIds(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function pageProblem(code: "REX225" | "REX230", page: AnyPage, problem: string): RexError {
  return new RexError(code, `registry: page "${page.id}" ${problem}`);
}

export function validatePageSet(pages: readonly AnyPage[]): void {
  const notFound = pages.find((declared) => declared.id === NOT_FOUND_PAGE_ID);
  if (notFound !== undefined) {
    if (notFound.policy.kind !== "always") {
      throw pageProblem(
        "REX230",
        notFound,
        "is the reserved not-found page and must keep policy always() so every actor sees it",
      );
    }
    for (const declared of pages) {
      if (declared.recovery === NOT_FOUND_PAGE_ID) {
        throw pageProblem("REX230", declared, `names the not-found page as its recovery page`);
      }
      if (declared.chrome.back === NOT_FOUND_PAGE_ID) {
        throw pageProblem("REX230", declared, `names the not-found page as chrome.back`);
      }
    }
  }
  const frames = new Map<string, string>();
  for (const declared of pages) {
    const frame = declared.chrome.frame;
    if (typeof frame !== "string") continue;
    const known = frames.get(frame.toLowerCase());
    if (known !== undefined && known !== frame) {
      throw pageProblem(
        "REX225",
        declared,
        `names chrome.frame "${frame}" while another page names "${known}"; frame names differ by case only`,
      );
    }
    frames.set(frame.toLowerCase(), frame);
  }
}

export function createRegistry(): Registry {
  const byKind = new Map<string, Map<string, AnyDeclaration>>(
    DECLARATION_KINDS.map((kind) => [kind, new Map()]),
  );

  const registry: Registry = {
    register(...declarations) {
      for (const declaration of declarations) {
        const candidate = declaration as { kind?: unknown; id?: unknown };
        if (typeof candidate !== "object" || candidate === null || !isKind(candidate.kind)) {
          throw new RexError(
            "REX224",
            `registry: expected a declaration with kind ${DECLARATION_KINDS.join(", ")}`,
          );
        }
        if (typeof candidate.id !== "string") {
          throw new RexError("REX224", `registry: ${candidate.kind} declaration has no id`);
        }
        const bucket = byKind.get(candidate.kind) as Map<string, AnyDeclaration>;
        const existing = bucket.get(candidate.id);
        if (existing !== undefined) {
          if (existing === declaration) continue;
          throw new RexDeclarationError(
            candidate.kind,
            candidate.id,
            "id",
            `is already registered by another ${candidate.kind}`,
            "REX217",
          );
        }
        bucket.set(candidate.id, declaration);
      }
      return registry;
    },
    has(kind, id) {
      return byKind.get(kind)?.has(id) ?? false;
    },
    freeze() {
      const lists: Record<string, readonly AnyDeclaration[]> = {};
      const indexes = new Map<string, ReadonlyMap<string, AnyDeclaration>>();
      for (const kind of DECLARATION_KINDS) {
        const bucket = byKind.get(kind) as Map<string, AnyDeclaration>;
        const sorted = [...bucket.values()].sort(compareIds);
        lists[LIST_NAMES[kind]] = Object.freeze(sorted);
        indexes.set(kind, new Map(sorted.map((declaration) => [declaration.id, declaration])));
      }
      validatePageSet(lists.pages as unknown as readonly AnyPage[]);
      const find = (kind: string, id: string) => indexes.get(kind)?.get(id);
      return Object.freeze({
        ...lists,
        find,
        get(kind: string, id: string) {
          const found = find(kind, id);
          if (found === undefined)
            throw new RexError("REX301", `registry: unknown ${kind} "${id}"`);
          return found;
        },
      }) as unknown as RegistrySnapshot;
    },
  };
  return registry;
}
