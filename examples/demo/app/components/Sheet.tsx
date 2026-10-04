import type { ReactNode } from "react";

export interface SheetProps {
  readonly description?: string;
  readonly children?: ReactNode;
}

export default function Sheet({ description, children }: SheetProps) {
  return (
    <div className="flex flex-col gap-4">
      {description === undefined ? null : (
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}
