import {
  parse as parseCookieHeader,
  serialize as serializeCookie,
} from "hono/utils/cookie";
import type { JsonSchema } from "../core/schema.ts";
import { issuePath, type StandardIssue } from "../core/standard.ts";

export const FORM_PREFIX = "/rex/form";
export const CSRF_COOKIE = "rex-csrf";
export const OUTCOME_COOKIE = "rex-outcome";
export const CSRF_FIELD = "_csrf";
export const CONFIRM_FIELD = "_confirm";
export const ACTION_FIELD = "_action";
export const LEGACY_ACTION_FIELD = "action";
export const FORM_RESERVED_FIELDS = [
  CSRF_FIELD,
  CONFIRM_FIELD,
  ACTION_FIELD,
] as const;
export const OUTCOME_COOKIE_MAX_AGE = 60;
export const FORM_ERRORS_KEY = "_form";

const CSRF_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const TRUE_VALUES = new Set(["true", "on", "1", "yes"]);
const FALSE_VALUES = new Set(["false", "off", "0", "no", ""]);

export type FormValue = string | File;

export interface FormOutcome {
  readonly actionId: string;
  readonly ok: boolean;
  readonly message: string;
  readonly at: string;
  readonly code: string | null;
  readonly fields: Readonly<Record<string, readonly string[]>>;
}

export function formPath(actionId: string): string {
  return `${FORM_PREFIX}/${encodeURIComponent(actionId)}`;
}

export function isFormReservedField(name: string): boolean {
  return (FORM_RESERVED_FIELDS as readonly string[]).includes(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaTypes(schema: JsonSchema): readonly string[] {
  const declared = schema.type;
  if (typeof declared === "string") return [declared];
  if (Array.isArray(declared)) {
    return declared.filter((item): item is string => typeof item === "string");
  }
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      return options.flatMap((option) =>
        isRecord(option) ? schemaTypes(option) : [],
      );
    }
  }
  return [];
}

function primaryType(schema: JsonSchema): string | null {
  return schemaTypes(schema).find((type) => type !== "null") ?? null;
}

function isNullable(schema: JsonSchema): boolean {
  return schemaTypes(schema).includes("null");
}

function objectBranch(schema: JsonSchema): JsonSchema {
  if (schema.type === "object" || isRecord(schema.properties)) return schema;
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (Array.isArray(options)) {
      const found = options.find(
        (option): option is JsonSchema =>
          isRecord(option) && primaryType(option) === "object",
      );
      if (found !== undefined) return found;
    }
  }
  return schema;
}

function itemBranch(schema: JsonSchema): JsonSchema {
  for (const candidate of [
    schema,
    ...["anyOf", "oneOf"].flatMap((key) => {
      const options = schema[key];
      return Array.isArray(options) ? options.filter(isRecord) : [];
    }),
  ]) {
    if (isRecord(candidate.items)) return candidate.items;
  }
  return {};
}

function propertiesOf(
  schema: JsonSchema,
): Readonly<Record<string, JsonSchema>> {
  const properties = objectBranch(schema).properties;
  if (!isRecord(properties)) return {};
  const result: Record<string, JsonSchema> = {};
  for (const [name, value] of Object.entries(properties)) {
    if (isRecord(value)) result[name] = value;
  }
  return result;
}

function requiredOf(schema: JsonSchema): ReadonlySet<string> {
  const required = objectBranch(schema).required;
  return new Set(
    Array.isArray(required)
      ? required.filter((item) => typeof item === "string")
      : [],
  );
}

export function schemaDeclaresField(schema: JsonSchema, name: string): boolean {
  return Object.hasOwn(propertiesOf(schema), name);
}

function coerceScalar(value: FormValue, schema: JsonSchema): unknown {
  if (typeof value !== "string") return value;
  const type = primaryType(schema);
  if (value === "" && isNullable(schema) && type !== "string") return null;
  switch (type) {
    case "number":
    case "integer": {
      const trimmed = value.trim();
      if (trimmed === "") return value;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }
    case "boolean": {
      const normalized = value.trim().toLowerCase();
      if (TRUE_VALUES.has(normalized)) return true;
      if (FALSE_VALUES.has(normalized)) return false;
      return value;
    }
    case "null":
      return value === "" ? null : value;
    default:
      return value;
  }
}

interface FormNode {
  values: FormValue[];
  children: Map<string, FormNode>;
}

function emptyNode(): FormNode {
  return { values: [], children: new Map() };
}

function insert(root: FormNode, name: string, value: FormValue): void {
  let node = root;
  for (const segment of name.split(".")) {
    let child = node.children.get(segment);
    if (child === undefined) {
      child = emptyNode();
      node.children.set(segment, child);
    }
    node = child;
  }
  node.values.push(value);
}

const ABSENT = Symbol("absent");

function coerceNode(
  node: FormNode | undefined,
  schema: JsonSchema,
  required: boolean,
): unknown {
  const type = primaryType(schema);
  if (type === "array") {
    if (node === undefined || node.values.length === 0) return [];
    const items = itemBranch(schema);
    return node.values.map((value) => coerceScalar(value, items));
  }
  if (
    type === "object" ||
    (type === null && node !== undefined && node.children.size > 0)
  ) {
    if (node === undefined || node.children.size === 0) {
      return required && type === "object"
        ? coerceObject(emptyNode(), schema)
        : ABSENT;
    }
    return coerceObject(node, schema);
  }
  if (type === "boolean" && (node === undefined || node.values.length === 0))
    return false;
  if (node === undefined || node.values.length === 0) return ABSENT;
  const values = node.values;
  const last = values[values.length - 1] as FormValue;
  if (!required && last === "" && !isNullable(schema)) return ABSENT;
  if (values.length > 1 && type === null)
    return values.map((value) => coerceScalar(value, schema));
  return coerceScalar(last, schema);
}

function coerceObject(
  node: FormNode,
  schema: JsonSchema,
): Record<string, unknown> {
  const properties = propertiesOf(schema);
  const required = requiredOf(schema);
  const result: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(properties)) {
    const value = coerceNode(
      node.children.get(name),
      property,
      required.has(name),
    );
    if (value !== ABSENT) result[name] = value;
  }
  for (const [name, child] of node.children) {
    if (Object.hasOwn(properties, name)) continue;
    const value = coerceNode(child, {}, false);
    if (value !== ABSENT) result[name] = value;
  }
  return result;
}

export function formEntries(
  form: FormData,
  schema: JsonSchema,
): [string, FormValue][] {
  const keepLegacyAction = schemaDeclaresField(schema, LEGACY_ACTION_FIELD);
  const entries: [string, FormValue][] = [];
  for (const [name, value] of form.entries()) {
    if (isFormReservedField(name)) continue;
    if (name === LEGACY_ACTION_FIELD && !keepLegacyAction) continue;
    entries.push([name, value]);
  }
  return entries;
}

export function coerceFormData(
  form: FormData,
  schema: JsonSchema,
): Record<string, unknown> {
  const root = emptyNode();
  for (const [name, value] of formEntries(form, schema))
    insert(root, name, value);
  return coerceObject(root, schema);
}

export function submittedActionId(
  form: FormData,
  schema: JsonSchema,
): string | null {
  const explicit = form.get(ACTION_FIELD);
  if (typeof explicit === "string") return explicit;
  if (schemaDeclaresField(schema, LEGACY_ACTION_FIELD)) return null;
  const legacy = form.get(LEGACY_ACTION_FIELD);
  return typeof legacy === "string" ? legacy : null;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (header === null) return null;
  return parseCookieHeader(header, name)[name] ?? null;
}

export function createCsrfToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function isCsrfToken(value: unknown): value is string {
  return typeof value === "string" && CSRF_TOKEN_PATTERN.test(value);
}

export function readCsrfToken(request: Request): string | null {
  const token = readCookie(request, CSRF_COOKIE);
  return isCsrfToken(token) ? token : null;
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

export function csrfCookie(token: string, request: Request): string {
  if (!isCsrfToken(token))
    throw new TypeError("csrfCookie: token must be 64 hex characters");
  return serializeCookie(CSRF_COOKIE, token, {
    path: "/",
    sameSite: "Lax",
    secure: isSecureRequest(request),
  });
}

export interface CsrfGrant {
  readonly token: string;
  readonly setCookie: string | null;
}

export function ensureCsrfToken(request: Request): CsrfGrant {
  const existing = readCsrfToken(request);
  if (existing !== null) return { token: existing, setCookie: null };
  const token = createCsrfToken();
  return { token, setCookie: csrfCookie(token, request) };
}

export function verifyCsrf(
  cookieToken: string | null,
  fieldToken: unknown,
): boolean {
  if (
    cookieToken === null ||
    !isCsrfToken(cookieToken) ||
    !isCsrfToken(fieldToken)
  )
    return false;
  let difference = 0;
  for (let index = 0; index < cookieToken.length; index++) {
    difference |= cookieToken.charCodeAt(index) ^ fieldToken.charCodeAt(index);
  }
  return difference === 0;
}

export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

export function refererPath(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (referer === null || referer === "") return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (url.origin !== requestOrigin(request)) return null;
  return `${url.pathname}${url.search}`;
}

export function formRedirectTarget(
  request: Request,
  redirect: string | null,
): string {
  return redirect ?? refererPath(request) ?? "/";
}

export function fieldErrors(
  issues: readonly StandardIssue[],
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) {
    const name = issuePath(issue) || FORM_ERRORS_KEY;
    (fields[name] ??= []).push(issue.message);
  }
  return fields;
}

export function encodeFormOutcome(outcome: FormOutcome): string {
  return JSON.stringify({
    actionId: outcome.actionId,
    ok: outcome.ok,
    message: outcome.message,
    at: outcome.at,
    code: outcome.code,
    fields: outcome.fields,
  });
}

function isFieldMap(value: unknown): value is Record<string, string[]> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === "string"),
    )
  );
}

export function decodeFormOutcome(
  value: string | null | undefined,
): FormOutcome | null {
  if (value === null || value === undefined || value === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const { actionId, ok, message, at, code, fields } = parsed;
  if (
    typeof actionId !== "string" ||
    actionId === "" ||
    typeof ok !== "boolean" ||
    typeof message !== "string" ||
    typeof at !== "string" ||
    Number.isNaN(Date.parse(at)) ||
    !(code === null || typeof code === "string") ||
    !isFieldMap(fields)
  ) {
    return null;
  }
  return { actionId, ok, message, at, code, fields };
}

export function readFormOutcome(request: Request): FormOutcome | null {
  return decodeFormOutcome(readCookie(request, OUTCOME_COOKIE));
}

export function outcomeCookie(outcome: FormOutcome, request: Request): string {
  return serializeCookie(OUTCOME_COOKIE, encodeFormOutcome(outcome), {
    path: "/",
    sameSite: "Lax",
    maxAge: OUTCOME_COOKIE_MAX_AGE,
    secure: isSecureRequest(request),
  });
}

export function clearOutcomeCookie(request: Request): string {
  return serializeCookie(OUTCOME_COOKIE, "", {
    path: "/",
    sameSite: "Lax",
    maxAge: 0,
    secure: isSecureRequest(request),
  });
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] as string,
  );
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof File !== "undefined" && value instanceof File) return value.name;
  return JSON.stringify(value) ?? String(value);
}

export function flattenInput(value: unknown, prefix = ""): [string, string][] {
  if (
    isRecord(value) &&
    !(typeof File !== "undefined" && value instanceof File)
  ) {
    const rows = Object.entries(value).flatMap(([key, child]) =>
      flattenInput(child, prefix === "" ? key : `${prefix}.${key}`),
    );
    return rows.length === 0 && prefix !== "" ? [[prefix, "{}"]] : rows;
  }
  if (Array.isArray(value))
    return [[prefix, value.map(displayValue).join(", ")]];
  return [[prefix, displayValue(value)]];
}

export interface ConfirmPageOptions {
  readonly actionId: string;
  readonly label: string;
  readonly title: string;
  readonly input: unknown;
  readonly entries: readonly (readonly [string, FormValue])[];
  readonly csrf: string;
  readonly token: string;
  readonly cancel: string;
  readonly expiresAt: string;
}

export function renderConfirmPage(options: ConfirmPageOptions): string {
  const id = escapeHtml(options.actionId);
  const label = escapeHtml(options.label);
  const title = escapeHtml(options.title);
  const rows = flattenInput(options.input)
    .map(
      ([name, value]) =>
        `<div data-rex-confirm-field="${escapeHtml(name)}"><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  const hidden = options.entries
    .filter(
      (entry): entry is readonly [string, string] =>
        typeof entry[1] === "string",
    )
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    "</head>",
    "<body>",
    `<main data-rex-confirm-page="${id}">`,
    `<section role="alertdialog" aria-labelledby="rex-confirm-title" aria-describedby="rex-confirm-body" data-rex-confirm="${id}">`,
    `<h1 id="rex-confirm-title">${title}</h1>`,
    `<p id="rex-confirm-body">${label} cannot be undone. Review the input before confirming.</p>`,
    `<dl data-rex-confirm-input="${id}">${rows}</dl>`,
    `<form method="post" action="${escapeHtml(formPath(options.actionId))}" data-rex-form="${id}">`,
    `<input type="hidden" name="${CSRF_FIELD}" value="${escapeHtml(options.csrf)}">`,
    `<input type="hidden" name="${ACTION_FIELD}" value="${id}">`,
    `<input type="hidden" name="${CONFIRM_FIELD}" value="${escapeHtml(options.token)}">`,
    hidden,
    `<p>This confirmation expires at <time datetime="${escapeHtml(options.expiresAt)}">${escapeHtml(options.expiresAt)}</time>.</p>`,
    `<button type="submit" data-rex-confirm-accept="${id}">Confirm ${label}</button>`,
    ` <a href="${escapeHtml(options.cancel)}" data-rex-confirm-cancel="${id}">Cancel</a>`,
    "</form>",
    "</section>",
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export interface FormErrorPageOptions {
  readonly title: string;
  readonly message: string;
  readonly back: string;
}

export function renderFormErrorPage(options: FormErrorPageOptions): string {
  const title = escapeHtml(options.title);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${title}</title>`,
    "</head>",
    "<body>",
    '<main data-rex-form-error="">',
    `<h1>${title}</h1>`,
    `<p role="alert">${escapeHtml(options.message)}</p>`,
    `<a href="${escapeHtml(options.back)}" data-rex-form-back="">Go back</a>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}
