import { overlay } from "@sidioralabs/rex/client";
import { createContext, use } from "react";
import Sheet from "../../../components/Sheet.tsx";
import TokenOptions, { type TokenOptionsProps } from "../regions/form/parts/TokenOptions.tsx";

export const TokenSelectorContent = createContext<TokenOptionsProps | null>(null);

export default overlay("TokenSelectorSheet", { dismiss: "both", binding: "region" }, () => {
  const content = use(TokenSelectorContent);
  return (
    <Sheet description="Pick the token to send.">
      {content === null ? (
        <p>Open the token selector from the form.</p>
      ) : (
        <TokenOptions {...content} />
      )}
    </Sheet>
  );
});
