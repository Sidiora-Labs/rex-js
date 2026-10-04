import { chargeCents } from "../../lib/billing.ts";

export default function View() {
  return <p>{chargeCents(1)}</p>;
}
