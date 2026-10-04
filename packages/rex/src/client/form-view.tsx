import { useId } from "react";
import type { ActionFormViewProps, FormField } from "./form.tsx";

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

export function ActionFormView({
  actionId,
  path,
  label,
  address,
  hidden,
  fields,
  errors,
  values,
  unplaced,
  submitLabel,
  controlProps,
  onSubmit,
  children,
}: ActionFormViewProps) {
  return (
    <form
      method="post"
      action={path}
      noValidate
      aria-label={label}
      data-rex-form={address}
      onSubmit={onSubmit}
    >
      {hidden.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields === null
        ? children
        : fields.map((field, index) => (
            <FormFieldRow
              key={field.path}
              field={field}
              error={errors[field.path]}
              value={values[index]}
            />
          ))}
      {unplaced.length === 0 ? null : (
        <ul data-rex-form-errors={actionId}>
          {unplaced.map(([key, problem]) => (
            <li key={key} data-rex-field-error={key}>
              {problem}
            </li>
          ))}
        </ul>
      )}
      <button type="submit" {...controlProps}>
        {submitLabel}
      </button>
    </form>
  );
}
