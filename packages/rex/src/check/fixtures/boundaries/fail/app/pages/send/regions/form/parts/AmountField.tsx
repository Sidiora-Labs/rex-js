import { useAct } from "@sidioralabs/rex/client";
import { Link } from "wouter";
import { send } from "../../../../../actions/send.ts";
import { memoryStore } from "@sidioralabs/rex";
import Button from "../../../../../components/Button.tsx";

export default function AmountField() {
  const act = useAct(send);
  return (
    <fieldset>
      <Link href="/">{typeof memoryStore}</Link>
      <Button {...act.controlProps}>Send</Button>
    </fieldset>
  );
}
