import type { ActControlProps } from "@sidioralabs/rex/client";
import Button from "../../../../../components/Button.tsx";
import Card from "../../../../../components/Card.tsx";

export interface SendSummaryProps {
  readonly symbol: string | null;
  readonly recipient: string | null;
  readonly amount: string;
  readonly valid: boolean;
  readonly control: ActControlProps;
  readonly onSend: () => void;
}

export default function SendSummary({
  symbol,
  recipient,
  amount,
  valid,
  control,
  onSend,
}: SendSummaryProps) {
  const shown = amount === "" ? "0.001 (default)" : amount;
  return (
    <Card title="Review">
      <p data-demo-summary="">
        {`Send ${shown} ${symbol ?? "?"} to ${recipient ?? "?"}`}
      </p>
      <p>Sending cannot be undone; you confirm it in the next step.</p>
      {valid ? null : <p role="alert">Fix the amount before sending.</p>}
      <Button
        {...control}
        tone="primary"
        disabled={control.disabled || !valid}
        aria-disabled={control["aria-disabled"] || !valid}
        onClick={onSend}
      >
        Send
      </Button>
    </Card>
  );
}
