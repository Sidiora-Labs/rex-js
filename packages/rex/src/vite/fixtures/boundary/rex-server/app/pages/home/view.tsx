import { createRexServer } from "@sidioralabs/rex/server";

export default function View() {
  return <p>{typeof createRexServer}</p>;
}
