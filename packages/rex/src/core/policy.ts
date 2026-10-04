import type { Actor } from "./actor.ts";
import { RexDeclarationError, declarationName, isPlainObject } from "./entity.ts";
import { validateName } from "./ids.ts";

export const REASON_NEVER = "never";
export const REASON_LOCKED = "locked";
export const REASON_NO_ACCOUNT = "no-account";
export const REASON_CUSTODY = "custody-mismatch";
export const MISSING_PERMISSION_PREFIX = "missing-permission:";

export type ReasonCode =
  | typeof REASON_NEVER
  | typeof REASON_LOCKED
  | typeof REASON_NO_ACCOUNT
  | typeof REASON_CUSTODY
  | `${typeof MISSING_PERMISSION_PREFIX}${string}`;

export type PolicyResult =
  | { readonly allowed: true; readonly reason: null }
  | { readonly allowed: false; readonly reason: ReasonCode };

export interface RequiresClause<P extends string = string> {
  readonly unlocked?: boolean;
  readonly account?: boolean;
  readonly custody?: string | readonly string[];
  readonly permissions?: readonly P[];
}

export type Predicate =
  | { readonly kind: "always" }
  | { readonly kind: "never" }
  | { readonly kind: "can"; readonly permission: string; readonly policy: AnyPolicy | null }
  | {
      readonly kind: "requires";
      readonly unlocked: boolean;
      readonly account: boolean;
      readonly custody: readonly string[] | null;
      readonly permissions: readonly string[];
      readonly policy: AnyPolicy | null;
    }
  | { readonly kind: "allOf"; readonly predicates: readonly Predicate[] }
  | { readonly kind: "anyOf"; readonly predicates: readonly Predicate[] };

export type PredicateJson =
  | { readonly kind: "always" }
  | { readonly kind: "never" }
  | { readonly kind: "can"; readonly permission: string; readonly policy: string | null }
  | {
      readonly kind: "requires";
      readonly unlocked: boolean;
      readonly account: boolean;
      readonly custody: readonly string[] | null;
      readonly permissions: readonly string[];
      readonly policy: string | null;
    }
  | { readonly kind: "allOf"; readonly predicates: readonly PredicateJson[] }
  | { readonly kind: "anyOf"; readonly predicates: readonly PredicateJson[] };

export interface PolicyConfig<P extends string> {
  readonly permissions: readonly P[];
  readonly resolve: (actor: Actor) => Iterable<P>;
}

export interface PolicyDeclaration<N extends string = string, P extends string = string> {
  readonly kind: "policy";
  readonly id: N;
  readonly name: N;
  readonly permissions: readonly P[];
  granted(actor: Actor): ReadonlySet<P>;
  can(permission: P): Predicate;
  requires(clause: RequiresClause<P>): Predicate;
}

export type AnyPolicy = PolicyDeclaration<string, string>;

const ALWAYS: Predicate = Object.freeze({ kind: "always" });
const NEVER: Predicate = Object.freeze({ kind: "never" });
const ALLOWED: PolicyResult = Object.freeze({ allowed: true, reason: null });

function denied(reason: ReasonCode): PolicyResult {
  return Object.freeze({ allowed: false, reason });
}

function predicateError(field: string, problem: string): RexDeclarationError {
  return new RexDeclarationError("predicate", "requires", field, problem);
}

export function always(): Predicate {
  return ALWAYS;
}

export function never(): Predicate {
  return NEVER;
}

function buildCan(permission: string, owner: AnyPolicy | null): Predicate {
  if (typeof permission !== "string") {
    throw new RexDeclarationError("predicate", "can", "permission", "must be a permission name");
  }
  validateName(permission, "permission");
  if (owner && !owner.permissions.includes(permission)) {
    throw new RexDeclarationError(
      "policy",
      owner.id,
      "permission",
      `names unknown permission "${permission}"`,
    );
  }
  return Object.freeze({ kind: "can", permission, policy: owner });
}

function buildRequires(clause: RequiresClause, owner: AnyPolicy | null): Predicate {
  if (!isPlainObject(clause)) throw predicateError("clause", "must be an object");
  const keys = Object.keys(clause);
  if (keys.length === 0) throw predicateError("clause", "must require at least one condition");
  for (const key of keys) {
    if (!["unlocked", "account", "custody", "permissions"].includes(key)) {
      throw predicateError(key, "is not a requires() condition");
    }
  }
  if (clause.unlocked !== undefined && typeof clause.unlocked !== "boolean") {
    throw predicateError("unlocked", "must be a boolean");
  }
  if (clause.account !== undefined && typeof clause.account !== "boolean") {
    throw predicateError("account", "must be a boolean");
  }
  let custody: readonly string[] | null = null;
  if (clause.custody !== undefined) {
    const values = typeof clause.custody === "string" ? [clause.custody] : clause.custody;
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some((value) => typeof value !== "string" || value.length === 0)
    ) {
      throw predicateError("custody", "must be a custody name or a non-empty list of names");
    }
    custody = Object.freeze([...values]);
  }
  let permissions: readonly string[] = Object.freeze([]);
  if (clause.permissions !== undefined) {
    if (!Array.isArray(clause.permissions)) {
      throw predicateError("permissions", "must be a list of permission names");
    }
    for (const permission of clause.permissions) {
      buildCan(permission, owner);
    }
    permissions = Object.freeze([...clause.permissions]);
  }
  return Object.freeze({
    kind: "requires",
    unlocked: clause.unlocked ?? false,
    account: clause.account ?? false,
    custody,
    permissions,
    policy: owner,
  });
}

export function can(permission: string): Predicate {
  return buildCan(permission, null);
}

export function requires(clause: RequiresClause): Predicate {
  return buildRequires(clause, null);
}

function combination(kind: "allOf" | "anyOf", predicates: readonly Predicate[]): Predicate {
  if (predicates.length === 0) {
    throw new RexDeclarationError(
      "predicate",
      kind,
      "predicates",
      "must contain at least one predicate",
    );
  }
  for (const [index, predicate] of predicates.entries()) {
    if (!isPredicate(predicate)) {
      throw new RexDeclarationError(
        "predicate",
        kind,
        `predicates.${index}`,
        "must be a predicate",
      );
    }
  }
  return Object.freeze({ kind, predicates: Object.freeze([...predicates]) });
}

export function allOf(...predicates: Predicate[]): Predicate {
  return combination("allOf", predicates);
}

export function anyOf(...predicates: Predicate[]): Predicate {
  return combination("anyOf", predicates);
}

export function isPredicate(value: unknown): value is Predicate {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "always" ||
    kind === "never" ||
    kind === "can" ||
    kind === "requires" ||
    kind === "allOf" ||
    kind === "anyOf"
  );
}

function grantedFor(actor: Actor, owner: AnyPolicy | null): ReadonlySet<string> {
  return owner ? owner.granted(actor) : new Set(actor.permissions);
}

function missingPermission(
  permissions: readonly string[],
  actor: Actor,
  owner: AnyPolicy | null,
): PolicyResult | null {
  if (permissions.length === 0) return null;
  const granted = grantedFor(actor, owner);
  for (const permission of permissions) {
    if (!granted.has(permission)) return denied(`${MISSING_PERMISSION_PREFIX}${permission}`);
  }
  return null;
}

export function evaluate(predicate: Predicate, actor: Actor): PolicyResult {
  switch (predicate.kind) {
    case "always":
      return ALLOWED;
    case "never":
      return denied(REASON_NEVER);
    case "can":
      return missingPermission([predicate.permission], actor, predicate.policy) ?? ALLOWED;
    case "requires": {
      if (predicate.unlocked && actor.attributes.unlocked !== true) return denied(REASON_LOCKED);
      if (predicate.account) {
        const account = actor.attributes.account;
        if (typeof account !== "string" || account.length === 0) return denied(REASON_NO_ACCOUNT);
      }
      if (predicate.custody) {
        const custody = actor.attributes.custody;
        if (typeof custody !== "string" || !predicate.custody.includes(custody)) {
          return denied(REASON_CUSTODY);
        }
      }
      return missingPermission(predicate.permissions, actor, predicate.policy) ?? ALLOWED;
    }
    case "allOf": {
      for (const inner of predicate.predicates) {
        const result = evaluate(inner, actor);
        if (!result.allowed) return result;
      }
      return ALLOWED;
    }
    case "anyOf": {
      let first: PolicyResult | null = null;
      for (const inner of predicate.predicates) {
        const result = evaluate(inner, actor);
        if (result.allowed) return result;
        first ??= result;
      }
      return first ?? denied(REASON_NEVER);
    }
  }
}

export function predicateToJson(predicate: Predicate): PredicateJson {
  switch (predicate.kind) {
    case "always":
    case "never":
      return { kind: predicate.kind };
    case "can":
      return {
        kind: "can",
        permission: predicate.permission,
        policy: predicate.policy ? predicate.policy.id : null,
      };
    case "requires":
      return {
        kind: "requires",
        unlocked: predicate.unlocked,
        account: predicate.account,
        custody: predicate.custody ? [...predicate.custody] : null,
        permissions: [...predicate.permissions],
        policy: predicate.policy ? predicate.policy.id : null,
      };
    case "allOf":
    case "anyOf":
      return { kind: predicate.kind, predicates: predicate.predicates.map(predicateToJson) };
  }
}

export function policy<const N extends string, const P extends string>(
  name: N,
  config: PolicyConfig<P>,
): PolicyDeclaration<N, P> {
  const id = declarationName("policy", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("policy", id, field, problem);
  };
  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  for (const property of Object.keys(config)) {
    if (property !== "permissions" && property !== "resolve") {
      fail(property, "is not part of the policy declaration");
    }
  }
  if (!Array.isArray(config.permissions) || config.permissions.length === 0) {
    fail("permissions", "must be a non-empty list of permission names");
  }
  const seen = new Set<string>();
  for (const [index, permission] of config.permissions.entries()) {
    try {
      validateName(permission, "permission");
    } catch (error) {
      fail(`permissions.${index}`, (error as Error).message);
    }
    if (seen.has(permission)) fail(`permissions.${index}`, `duplicates "${permission}"`);
    seen.add(permission);
  }
  if (typeof config.resolve !== "function")
    fail("resolve", "must be a function from actor to permissions");

  const permissions = Object.freeze([...config.permissions]) as readonly P[];
  const resolve = config.resolve;

  const declaration: PolicyDeclaration<N, P> = Object.freeze({
    kind: "policy",
    id,
    name: id,
    permissions,
    granted(subject: Actor): ReadonlySet<P> {
      const granted = new Set<P>();
      for (const permission of resolve(subject)) {
        if (!seen.has(permission)) {
          throw new RexDeclarationError(
            "policy",
            id,
            "resolve",
            `granted unknown permission "${String(permission)}"`,
          );
        }
        granted.add(permission);
      }
      return granted;
    },
    can(permission: P): Predicate {
      return buildCan(permission, declaration as AnyPolicy);
    },
    requires(clause: RequiresClause<P>): Predicate {
      return buildRequires(clause, declaration as AnyPolicy);
    },
  });
  return declaration;
}
