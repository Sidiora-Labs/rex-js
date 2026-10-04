import type { ActControlProps } from "@sidioralabs/rex/client";
import { useId } from "react";
import { Switch } from "../../../../../components/ui/switch.tsx";

export interface DustToggleProps {
  readonly hideDust: boolean;
  readonly hiddenCount: number;
  readonly control: ActControlProps;
  readonly onToggle: () => void;
}

export default function DustToggle({ hideDust, hiddenCount, control, onToggle }: DustToggleProps) {
  const labelId = useId();
  const statusId = useId();
  return (
    <div className="flex items-center gap-3">
      <Switch
        {...control}
        checked={hideDust}
        aria-labelledby={labelId}
        aria-describedby={statusId}
        onCheckedChange={() => onToggle()}
      />
      <span className="flex flex-col">
        <span id={labelId} className="text-sm font-medium">
          Hide dust
        </span>
        <span
          id={statusId}
          className="text-xs text-muted-foreground"
          data-demo-dust={hideDust ? "hidden" : "shown"}
        >
          {hideDust
            ? `Dust is hidden (${hiddenCount} ${hiddenCount === 1 ? "token" : "tokens"} under $1)`
            : "Dust is shown"}
        </span>
      </span>
    </div>
  );
}
