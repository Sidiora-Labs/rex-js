import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "./ui/badge.tsx";

export interface ChangeBadgeProps {
  readonly pct: string;
  readonly label?: string;
}

export default function ChangeBadge({ pct, label = "24h" }: ChangeBadgeProps) {
  const value = Number(pct);
  const down = value < 0;
  const Icon = down ? TrendingDownIcon : TrendingUpIcon;
  const text = `${down ? "" : "+"}${value.toFixed(2)}%`;
  return (
    <Badge variant={down ? "destructive" : "success"} data-demo-change={down ? "down" : "up"}>
      <Icon aria-hidden="true" />
      <span>{text}</span>
      <span className="sr-only"> {label}</span>
    </Badge>
  );
}
