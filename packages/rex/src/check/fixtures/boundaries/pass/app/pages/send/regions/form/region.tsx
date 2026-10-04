import { useAct } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";
import Button from "../../../../components/Button.tsx";
import { useTokens } from "../../hooks/useTokens.ts";
import TokenSheet from "../../overlays/TokenSheet.tsx";
import AmountField from "./parts/AmountField.tsx";

export default function FormRegion() {
  const tokens = useTokens();
  const sendAct = useAct(send);
  return (
    <form>
      <AmountField tokens={tokens} />
      <TokenSheet tokens={tokens} />
      <Button {...sendAct.controlProps}>Send</Button>
    </form>
  );
}
