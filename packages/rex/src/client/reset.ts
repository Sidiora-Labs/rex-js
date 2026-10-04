import { RexError } from "../core/errors.ts";

export type RexReset = () => void;

const resets = new Set<RexReset>();

export function registerReset(reset: RexReset): () => void {
  if (typeof reset !== "function") {
    throw new RexError("REX329", "registerReset: reset must be a function");
  }
  resets.add(reset);
  return () => {
    resets.delete(reset);
  };
}

export function resetAll(): void {
  for (const reset of [...resets]) reset();
}
