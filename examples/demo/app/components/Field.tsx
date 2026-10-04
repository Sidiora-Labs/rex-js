import { useId, type InputHTMLAttributes } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | null;
}

export default function Field({ label, hint, error = null, ...input }: FieldProps) {
  const inputId = useId();
  const hintId = useId();
  const described = error !== null || hint !== undefined ? hintId : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--rex-space-1)" }}>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-invalid={error !== null}
        aria-describedby={described}
        {...input}
        style={{
          minBlockSize: "var(--rex-hit-target)",
          paddingBlock: "var(--rex-space-2)",
          paddingInline: "var(--rex-space-3)",
          borderRadius: "var(--rex-radius-1)",
          border: "1px solid currentcolor",
          color: "inherit",
          background: "transparent",
        }}
      />
      {described === undefined ? null : (
        <small id={hintId} role={error === null ? undefined : "alert"}>
          {error ?? hint}
        </small>
      )}
    </div>
  );
}
