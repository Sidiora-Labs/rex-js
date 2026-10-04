import { useAct } from "@sidioralabs/rex/client";
import { pickContact } from "../../../../actions/pick-contact.ts";
import { send } from "../../../../actions/send.ts";

export default function FormRegion() {
  const sendAct = useAct(send);
  const pick = useAct(pickContact);
  return (
    <form>
      <button {...pick.controlProps}>Pick contact</button>
      <button {...sendAct.controlProps}>Send</button>
    </form>
  );
}
