import { tokenStore } from "../data/tokens.ts";
import { token } from "../entities/token.ts";

export async function ledgerBalance(symbol: string): Promise<number> {
  const found = await tokenStore.get(symbol);
  return found === undefined ? 0 : token.id.length;
}
