import { useAct } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";

export default function ConfirmRegion() {
  const sendAct = useAct(send);
  return <button {...sendAct.controlProps}>Send</button>;
}
