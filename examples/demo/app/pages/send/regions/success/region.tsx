import { region } from "@sidioralabs/rex/client";
import { useWallet } from "../../hooks/useWallet.ts";
import TransferReceipt from "./parts/TransferReceipt.tsx";

export default region("success", () => {
  const wallet = useWallet();
  const data = wallet.data;
  if (data === undefined) return null;
  return <TransferReceipt transfer={data.account.lastTransfer} />;
});
