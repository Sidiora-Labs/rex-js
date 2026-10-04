import type { ReactNode } from "react";

export interface CardProps {
  readonly title?: string;
  readonly children?: ReactNode;
}

export default function Card({ title, children }: CardProps) {
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
      {title === undefined ? null : <h3 style={{ margin: 0 }}>{title}</h3>}
      {children}
    </div>
  );
}
