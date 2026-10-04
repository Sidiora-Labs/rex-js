import { defineElement } from "@sidioralabs/rex/client/interop";
import type { DetailedHTMLProps, HTMLAttributes } from "react";
import TokenChip from "./TokenChip.tsx";

export const TOKEN_CHIP_TAG = "demo-token-chip";

interface TokenChipAttributes extends HTMLAttributes<HTMLElement> {
  readonly symbol?: string;
  readonly price?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "demo-token-chip": DetailedHTMLProps<TokenChipAttributes, HTMLElement>;
    }
  }
}

export function defineTokenChip(): void {
  if (typeof customElements === "undefined" || customElements.get(TOKEN_CHIP_TAG) !== undefined) {
    return;
  }
  defineElement(TOKEN_CHIP_TAG, TokenChip, { props: { symbol: "string", price: "string" } });
}
