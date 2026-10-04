import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "./ui/card.tsx";

export interface SheetProps {
  readonly description?: string;
  readonly children?: ReactNode;
}

export default function Sheet({ description, children }: SheetProps) {
  return (
    <Card variant="elevated" className="bg-popover text-popover-foreground">
      {description === undefined ? null : (
        <CardHeader>
          <CardDescription>
            <p className="m-0">{description}</p>
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
