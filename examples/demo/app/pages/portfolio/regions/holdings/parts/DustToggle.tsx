import type { ActControlProps } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";

export interface DustToggleProps {
  readonly hideDust: boolean;
  readonly hiddenCount: number;
  readonly control: ActControlProps;
  readonly onToggle: () => void;
}

export default function DustToggle({ hideDust, hiddenCount, control, onToggle }: DustToggleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--rex-space-3)" }}>
      <Button {...control} aria-pressed={hideDust} onClick={onToggle}>
        {hideDust ? "Show dust" : "Hide dust"}
      </Button>
      <p style={{ margin: 0 }} data-demo-dust={hideDust ? "hidden" : "shown"}>
        {hideDust
          ? `Dust is hidden (${hiddenCount} ${hiddenCount === 1 ? "token" : "tokens"} under $1)`
          : "Dust is shown"}
      </p>
    </div>
  );
}
