import type { ReactNode } from "react";

export interface SheetProps {
  readonly description?: string;
  readonly children?: ReactNode;
}

export default function Sheet({ description, children }: SheetProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--rex-space-3)",
        padding: "var(--rex-space-4)",
        borderRadius: "var(--rex-radius-3)",
        border: "1px solid currentcolor",
      }}
    >
      {description === undefined ? null : <p style={{ margin: 0 }}>{description}</p>}
      {children}
    </div>
  );
}
