import type { ReactNode } from "react";
import { Card as DesignxCard, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";

export interface CardProps {
  readonly title?: string;
  readonly children?: ReactNode;
}

export default function Card({ title, children }: CardProps) {
  return (
    <DesignxCard>
      {title === undefined ? null : (
        <CardHeader>
          <CardTitle>
            <h3 className="m-0 font-[inherit] text-[length:inherit]">{title}</h3>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </DesignxCard>
  );
}
