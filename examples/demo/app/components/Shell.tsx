import {
  outcomeStatusText,
  useOutcome,
  type ShellButtonProps,
  type ShellOutcomeProps,
  type ShellPaletteItemProps,
  type ShellSheetProps,
} from "@sidioralabs/rex/client";
import { Badge } from "./ui/badge.tsx";
import { Button as DesignxButton } from "./ui/button.tsx";
import { Card, CardContent, CardHeader } from "./ui/card.tsx";
import { Kbd } from "./ui/kbd.tsx";

export function Button({ type = "button", ...props }: ShellButtonProps) {
  return <DesignxButton type={type} variant="outline" {...props} />;
}

export function Sheet({ title, titleId, children }: ShellSheetProps) {
  return (
    <Card variant="elevated" className="bg-popover text-popover-foreground">
      <CardHeader>
        <h2 id={titleId} className="m-0">
          {title}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

export function PaletteItem({ label, detail, shortcut, allowed, reason }: ShellPaletteItemProps) {
  return (
    <span className="flex items-center gap-2">
      <span>{label}</span> <code>{detail}</code>
      {shortcut === null ? null : <Kbd>{shortcut}</Kbd>}
      {allowed ? null : <Badge variant="outline"> Not allowed: {reason ?? ""}</Badge>}
    </span>
  );
}

export function Outcome({ page }: ShellOutcomeProps) {
  const outcome = useOutcome(page);
  if (outcome === null) return null;
  return (
    <p className="m-0">
      <strong>{outcomeStatusText(outcome)}</strong>: {outcome.message}
    </p>
  );
}
