import { Badge } from "../../../../../components/ui/badge.tsx";

export interface StatusBadgeProps {
  readonly status: "met" | "partial";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={status === "met" ? "success" : "warning"} data-site-standard-status={status}>
      {status === "met" ? "Met" : "Partial"}
    </Badge>
  );
}
