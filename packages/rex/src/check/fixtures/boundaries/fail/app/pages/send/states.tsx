import type { StateProps } from "@sidioralabs/rex";
import { useTokens } from "./hooks/useTokens.ts";

export function Loading(_props: StateProps) {
  return <p>{useTokens().length}</p>;
}
