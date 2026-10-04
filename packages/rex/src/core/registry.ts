import type { AnyAction } from "./action.ts";
import { RexDeclarationError } from "./entity.ts";
import type { AnyEntity } from "./entity.ts";
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

export function createRegistry(): Registry {
  const byKind = new Map<string, Map<string, AnyDeclaration>>(
    DECLARATION_KINDS.map((kind) => [kind, new Map()]),
  );

  const registry: Registry = {
    register(...declarations) {
      for (const declaration of declarations) {
        const candidate = declaration as { kind?: unknown; id?: unknown };
        if (typeof candidate !== "object" || candidate === null || !isKind(candidate.kind)) {
          throw new TypeError(
            `registry: expected a declaration with kind ${DECLARATION_KINDS.join(", ")}`,
          );
        }
        if (typeof candidate.id !== "string") {
          throw new TypeError(`registry: ${candidate.kind} declaration has no id`);
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
      const find = (kind: string, id: string) => indexes.get(kind)?.get(id);
      return Object.freeze({
        ...lists,
        find,
        get(kind: string, id: string) {
          const found = find(kind, id);
          if (found === undefined) throw new Error(`registry: unknown ${kind} "${id}"`);
          return found;
        },
      }) as unknown as RegistrySnapshot;
    },
  };
  return registry;
}
