import { useState } from "react";
import { useTokens } from "./hooks/useTokens.ts";
import AmountField from "./regions/form/parts/AmountField.tsx";
import FormRegion from "./regions/form/region.tsx";

export default function SendView() {
  const [open] = useState(false);
  const tokens = useTokens();
  return (
    <article>
      <FormRegion />
      {open ? <AmountField /> : tokens.length}
    </article>
  );
}
