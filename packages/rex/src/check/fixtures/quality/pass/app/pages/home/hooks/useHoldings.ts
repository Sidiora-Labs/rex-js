import { useState } from "react";

export function useHoldings(): readonly string[] {
  const [holdings] = useState<readonly string[]>(["PAX", "ETH"]);
  return holdings;
}
