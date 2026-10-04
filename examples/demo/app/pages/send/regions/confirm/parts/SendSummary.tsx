import { ShieldAlertIcon } from "../../../../../components/icons.ts";
import type { ReactNode } from "react";
import Card from "../../../../../components/Card.tsx";
import { Alert, AlertDescription } from "../../../../../components/ui/alert.tsx";
import { Separator } from "../../../../../components/ui/separator.tsx";

export interface SendSummaryProps {
  readonly symbol: string | null;
  readonly recipient: string | null;
  readonly amount: string;
  readonly valid: boolean;
  readonly children: ReactNode;
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export default function SendSummary({
  symbol,
  recipient,
  amount,
  valid,
  children,
}: SendSummaryProps) {
  const shown = amount === "" ? "0.001 (default)" : amount;
  return (
    <Card title="Review" variant="elevated">
      <p className="m-0 text-[15px] font-medium" data-demo-summary="">
        {`Send ${shown} ${symbol ?? "?"} to ${recipient ?? "?"}`}
      </p>
      <dl className="m-0 flex flex-col gap-2">
        <Row label="Token" value={symbol ?? "Not selected"} />
        <Row label="Amount" value={shown} />
        <Row label="Recipient" value={recipient ?? "Not selected"} />
        <Row label="Network fee" value="Included" />
      </dl>
      <Separator />
      <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Sending cannot be undone; you confirm it in the next step.
      </p>
      {valid ? null : (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="m-0">Fix the amount before sending.</p>
          </AlertDescription>
        </Alert>
      )}
      {children}
    </Card>
  );
}
