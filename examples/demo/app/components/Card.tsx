import type { ReactNode } from "react";
import {
  CardAction,
  CardContent,
  CardDescription,
  Card as DesignxCard,
  CardHeader,
  CardTitle,
} from "./ui/card.tsx";

export interface CardProps {
  readonly title?: string;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
  readonly variant?: "outline" | "tonal" | "elevated";
  readonly className?: string;
  readonly children?: ReactNode;
}

export default function Card({
  title,
  description,
  action,
  variant = "outline",
  className,
  children,
}: CardProps) {
  return (
    <DesignxCard variant={variant} className={className}>
      {title === undefined ? null : (
        <CardHeader>
          <CardTitle>
            <h2 className="m-0 text-base leading-snug font-medium tracking-[-0.01em]">{title}</h2>
          </CardTitle>
          {description === undefined ? null : <CardDescription>{description}</CardDescription>}
          {action === undefined ? null : <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </DesignxCard>
  );
}
