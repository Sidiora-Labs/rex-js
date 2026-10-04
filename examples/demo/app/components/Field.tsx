import { useId, type InputHTMLAttributes } from "react";
import { Input } from "./ui/input.tsx";

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
    <div className="flex flex-col gap-1.5" data-invalid={error === null ? undefined : ""}>
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={inputId} aria-invalid={error !== null} aria-describedby={described} {...input} />
      {described === undefined ? null : (
        <small
          id={hintId}
          role={error === null ? undefined : "alert"}
          className={error === null ? "text-muted-foreground" : "text-destructive"}
        >
          {error ?? hint}
        </small>
      )}
    </div>
  );
}
