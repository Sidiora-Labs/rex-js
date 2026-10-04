import { CircleCheckIcon, HistoryIcon } from "../../../../../components/icons.ts";
import { Alert, AlertDescription, AlertTitle } from "../../../../../components/ui/alert.tsx";

export interface TransferReceiptProps {
  readonly transfer: string | null;
}

export default function TransferReceipt({ transfer }: TransferReceiptProps) {
  const sent = transfer !== null;
  const Icon = sent ? CircleCheckIcon : HistoryIcon;
  return (
    <Alert role="status" variant={sent ? "success" : "outline"}>
      <Icon aria-hidden="true" />
      <AlertTitle>
        <h2 className="m-0 text-sm font-medium">Last transfer</h2>
      </AlertTitle>
      <AlertDescription>
        <p className="m-0 break-all" data-demo-transfer={sent ? "sent" : "none"}>
          {transfer ?? "No transfer has been sent from this wallet yet."}
        </p>
      </AlertDescription>
    </Alert>
  );
}
