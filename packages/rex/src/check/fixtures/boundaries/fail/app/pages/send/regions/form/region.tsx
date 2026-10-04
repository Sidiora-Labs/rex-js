import { useAct } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";
import { tokenStore } from "../../../../data/tokens.ts";
import HoldingRow from "../../../portfolio/regions/holdings/parts/HoldingRow.tsx";
import ConfirmRegion from "../confirm/region.tsx";
import { helper } from "./missing.ts";
import AmountField from "./parts/AmountField.tsx";

export default function FormRegion() {
  const sendAct = useAct(send);
  void fetch("/api/tokens");
  return (
    <form>
      <AmountField />
      <HoldingRow symbol={String(tokenStore)} />
      <ConfirmRegion />
      <button {...sendAct.controlProps}>{helper}</button>
    </form>
  );
}
