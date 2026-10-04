import { useAct } from "@sidioralabs/rex/client";
import { pickToken } from "../../../../actions/pick-token.ts";
import TokenSheet from "../../overlays/TokenSheet.tsx";
import TokenField from "./parts/TokenField.tsx";

export default function FormRegion() {
  const pick = useAct(pickToken);
  return (
    <form>
      <TokenField symbol="PAX" />
      <button {...pick.controlProps}>Pick token</button>
      <TokenSheet />
    </form>
  );
}
