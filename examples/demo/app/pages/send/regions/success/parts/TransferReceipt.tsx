import Card from "../../../../../components/Card.tsx";

export interface TransferReceiptProps {
  readonly transfer: string | null;
}

export default function TransferReceipt({ transfer }: TransferReceiptProps) {
  return (
    <Card title="Last transfer">
      <p data-demo-transfer={transfer === null ? "none" : "sent"}>
        {transfer ?? "No transfer has been sent from this wallet yet."}
      </p>
    </Card>
  );
}
