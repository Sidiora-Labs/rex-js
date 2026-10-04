import {
  createContext,
  useContext,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ActionInput, AnyAction } from "../core/action.ts";
import { isPlainObject } from "../core/entity.ts";
import type { JsonSchema } from "../core/schema.ts";
import { issuePath, validateStandard, type StandardIssue } from "../core/standard.ts";
import { actionLabel, type ActResult } from "./act.ts";
import { useInvoke } from "./agent/confirm.tsx";
import { outcomeErrors, readCookie, type FieldErrors } from "./agent/outcome.tsx";
import { useManifest } from "./context.ts";
import { APP_OUTCOME_KEY, useOutcome } from "./outcome.ts";
import { useActivePage } from "./router.tsx";

export const REX_FORM_PREFIX = "/rex/form";
export const CSRF_COOKIE = "rex-csrf";
export const CSRF_FIELD = "_csrf";
export const ACTION_FIELD = "_action";
export const CONFIRM_FIELD = "_confirm";
export const FORM_ERRORS_KEY = "_form";

export function formActionPath(actionId: string): string {
  return `${REX_FORM_PREFIX}/${actionId}`;
}

export const CsrfTokenContext = createContext<string | null>(null);
CsrfTokenContext.displayName = "RexCsrfToken";

function mintToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ensureCsrfCookie(): string {
  const existing = readCookie(CSRF_COOKIE, document.cookie);
  if (existing !== null && existing !== "") return existing;
  const token = mintToken();
  const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax${secure}`;
  return token;
}

export function useCsrfToken(): string {
  const provided = useContext(CsrfTokenContext);
  const [minted] = useState(() =>
    provided !== null || typeof document === "undefined" ? "" : ensureCsrfCookie(),
  );
  return provided ?? minted;
}

export type FormFieldControl = "text" | "number" | "checkbox" | "select" | "multiselect";

export interface FormField {
  readonly path: string;
  readonly label: string;
  readonly control: FormFieldControl;
  readonly required: boolean;
  readonly type: string;
  readonly options: readonly string[];
  readonly schema: JsonSchema;
}

function schemaBranch(schema: JsonSchema): JsonSchema {
  const anyOf = schema.anyOf ?? schema.oneOf;
  if (!Array.isArray(anyOf)) return schema;
  const branch = anyOf.find(
    (entry): entry is JsonSchema => isPlainObject(entry) && entry.type !== "null",
  );
  return branch ?? schema;
}

function schemaType(schema: JsonSchema): string {
  return typeof schema.type === "string" ? schema.type : "string";
}

function enumValues(schema: JsonSchema): readonly string[] {
  return Array.isArray(schema.enum)
    ? schema.enum.filter((value): value is string => typeof value === "string")
    : [];
}

export function fieldLabel(name: string, schema: JsonSchema): string {
  if (typeof schema.title === "string" && schema.title.trim() !== "") return schema.title;
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s._-]+/)
    .filter((word) => word.length > 0)
    .join(" ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function propertiesOf(schema: JsonSchema): readonly [string, JsonSchema][] {
  const properties = schema.properties;
  if (!isPlainObject(properties)) return [];
  return Object.entries(properties).filter((entry): entry is [string, JsonSchema] =>
    isPlainObject(entry[1]),
  );
}

function requiredOf(schema: JsonSchema): ReadonlySet<string> {
  return new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
}

export function formFields(schema: JsonSchema, prefix = ""): readonly FormField[] {
  const required = requiredOf(schema);
  const fields: FormField[] = [];
  for (const [name, raw] of propertiesOf(schema)) {
    const property = schemaBranch(raw);
    const path = prefix === "" ? name : `${prefix}.${name}`;
    const type = schemaType(property);
    if (type === "object") {
      fields.push(...formFields(property, path));
      continue;
    }
    const items = isPlainObject(property.items) ? schemaBranch(property.items) : null;
    const options = type === "array" && items !== null ? enumValues(items) : enumValues(property);
    let control: FormFieldControl = "text";
    if (type === "boolean") control = "checkbox";
    else if (type === "integer" || type === "number") control = "number";
    else if (type === "array") control = "multiselect";
    else if (options.length > 0) control = "select";
    fields.push({
      path,
      label: fieldLabel(name, property),
      control,
      required: required.has(name),
      type,
      options,
      schema: property,
    });
  }
  return fields;
}

function coerceScalar(type: string, raw: string): unknown {
  if (type === "integer" || type === "number") {
    const value = Number(raw);
    return raw.trim() !== "" && Number.isFinite(value) ? value : raw;
  }
  if (type === "boolean") return raw === "true" || raw === "on" || raw === "1";
  return raw;
}

function coerceObject(schema: JsonSchema, data: FormData, prefix: string): Record<string, unknown> {
  const required = requiredOf(schema);
  const result: Record<string, unknown> = {};
  for (const [name, raw] of propertiesOf(schema)) {
    const property = schemaBranch(raw);
    const path = prefix === "" ? name : `${prefix}.${name}`;
    const type = schemaType(property);
    if (type === "object") {
      result[name] = coerceObject(property, data, path);
      continue;
    }
    const values = data.getAll(path).filter((value): value is string => typeof value === "string");
    if (type === "array") {
      const items = isPlainObject(property.items)
        ? schemaType(schemaBranch(property.items))
        : "string";
      result[name] = values.map((value) => coerceScalar(items, value));
      continue;
    }
    if (type === "boolean") {
      result[name] = values.some((value) => coerceScalar(type, value) === true);
      continue;
    }
    const value = values.at(-1);
    if (value === undefined || (value === "" && !required.has(name))) continue;
    result[name] = coerceScalar(type, value);
  }
  return result;
}

export function formInput(schema: JsonSchema, data: FormData): Record<string, unknown> {
  return coerceObject(schema, data, "");
}

export function fieldErrors(issues: readonly StandardIssue[]): FieldErrors {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    (errors[issuePath(issue) || FORM_ERRORS_KEY] ??= []).push(issue.message);
  }
  return Object.freeze(errors);
}

function valueAt(values: unknown, path: string): unknown {
  let current = values;
  for (const key of path.split(".")) {
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}

interface FieldControlProps {
  readonly field: FormField;
  readonly id: string;
  readonly error: readonly string[] | undefined;
  readonly errorId: string;
  readonly value: unknown;
}

function FieldControl({ field, id, error, errorId, value }: FieldControlProps) {
  const invalid = error === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorId };
  const required = field.required && field.control !== "checkbox";
  const common = { id, name: field.path, required, ...invalid };
  const { schema } = field;
  switch (field.control) {
    case "checkbox":
      return <input type="checkbox" value="true" defaultChecked={value === true} {...common} />;
    case "select":
      return (
        <select defaultValue={textValue(value) ?? ""} {...common}>
          {field.required ? null : <option value="">None</option>}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "multiselect":
      return (
        <select
          multiple
          defaultValue={Array.isArray(value) ? value.map((entry) => String(entry)) : []}
          {...common}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          step={field.type === "integer" ? 1 : "any"}
          {...(typeof schema.minimum === "number" ? { min: schema.minimum } : {})}
          {...(typeof schema.maximum === "number" && Number.isSafeInteger(schema.maximum)
            ? { max: schema.maximum }
            : {})}
          defaultValue={textValue(value)}
          {...common}
        />
      );
    case "text":
      return (
        <input
          type="text"
          {...(schema.format === "decimal" ? { inputMode: "decimal" as const } : {})}
          {...(typeof schema.minLength === "number" ? { minLength: schema.minLength } : {})}
          {...(typeof schema.maxLength === "number" ? { maxLength: schema.maxLength } : {})}
          defaultValue={textValue(value)}
          {...common}
        />
      );
  }
}

function FormFieldRow({
  field,
  error,
  value,
}: {
  readonly field: FormField;
  readonly error: readonly string[] | undefined;
  readonly value: unknown;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const checkbox = field.control === "checkbox";
  const label = <label htmlFor={id}>{field.label}</label>;
  return (
    <div data-rex-field={field.path}>
      {checkbox ? null : label}
      <FieldControl field={field} id={id} error={error} errorId={errorId} value={value} />
      {checkbox ? label : null}
      {error === undefined ? null : (
        <p id={errorId} data-rex-field-error={field.path}>
          {error.join("; ")}
        </p>
      )}
    </div>
  );
}

export interface ActionFormProps<A extends AnyAction> {
  readonly action: A;
  readonly defaultValues?: Partial<ActionInput<A>>;
  readonly submitLabel?: string;
  readonly children?: ReactNode;
  readonly onResult?: (result: ActResult<A>) => void;
}

export function ActionForm<A extends AnyAction>({
  action: declared,
  defaultValues,
  submitLabel,
  children,
  onResult,
}: ActionFormProps<A>) {
  const manifest = useManifest();
  const active = useActivePage();
  const handle = useInvoke(declared);
  const csrf = useCsrfToken();
  const pageKey = active === null ? APP_OUTCOME_KEY : active.page.id;
  const outcome = useOutcome(pageKey);
  const [submitted, setSubmitted] = useState<FieldErrors | null>(null);

  if (active !== null && !active.page.actions.includes(declared)) {
    throw new Error(
      `rex: ActionForm action "${declared.id}" is not declared by page "${active.page.id}"`,
    );
  }
  const listed = manifest.actions.find((entry) => entry.id === declared.id);
  if (listed === undefined) {
    throw new Error(`rex: ActionForm action "${declared.id}" is not in the manifest`);
  }
  const fields = formFields(listed.input);
  const errors = submitted ?? outcomeErrors(outcome, declared.id) ?? {};
  const known = new Set(children === undefined ? fields.map((field) => field.path) : []);
  const unplaced = Object.entries(errors).filter(([path]) => !known.has(path));
  const label = actionLabel(declared);
  const { invoke, controlProps } = handle;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = formInput(listed.input, new FormData(event.currentTarget));
    const checked = await validateStandard(declared.input, input);
    setSubmitted(checked.issues === undefined ? {} : fieldErrors(checked.issues));
    const result = await invoke(input as ActionInput<A>);
    onResult?.(result);
  };

  return (
    <form
      method="post"
      action={formActionPath(declared.id)}
      noValidate
      aria-label={label}
      data-rex-form={handle.controlProps["data-rex"] ?? declared.id}
      onSubmit={(event) => void onSubmit(event)}
    >
      <input type="hidden" name={CSRF_FIELD} value={csrf} />
      <input type="hidden" name={ACTION_FIELD} value={declared.id} />
      {children ??
        fields.map((field) => (
          <FormFieldRow
            key={field.path}
            field={field}
            error={errors[field.path]}
            value={valueAt(defaultValues, field.path)}
          />
        ))}
      {unplaced.length === 0 ? null : (
        <ul data-rex-form-errors={declared.id}>
          {unplaced.map(([path, problem]) => (
            <li key={path} data-rex-field-error={path}>
              {path === FORM_ERRORS_KEY ? problem.join("; ") : `${path}: ${problem.join("; ")}`}
            </li>
          ))}
        </ul>
      )}
      <button type="submit" {...controlProps}>
        {submitLabel ?? label}
      </button>
    </form>
  );
}
