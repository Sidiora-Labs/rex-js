import { signingKey } from "../../server/secrets.ts";

export default function View() {
  return <p>{signingKey.length}</p>;
}
