import { region, useOverlay } from "@sidioralabs/rex/client";
import { useState } from "react";
import { pickContact } from "../../../../actions/pick-contact.ts";
import { pickToken } from "../../../../actions/pick-token.ts";
import Card from "../../../../components/Card.tsx";
import { useSendDraft } from "../../hooks/useSendDraft.ts";
import { useWallet } from "../../hooks/useWallet.ts";
import ContactPickerSheet, { ContactPickerContent } from "../../overlays/ContactPickerSheet.tsx";
import TokenSelectorSheet, { TokenSelectorContent } from "../../overlays/TokenSelectorSheet.tsx";
import AmountField from "./parts/AmountField.tsx";
import ContactField from "./parts/ContactField.tsx";
import TokenField from "./parts/TokenField.tsx";

export default region("form", ({ act }) => {
  const wallet = useWallet();
  const draft = useSendDraft();
  const tokenAct = act(pickToken);
  const contactAct = act(pickContact);
  const tokenSheet = useOverlay(TokenSelectorSheet);
  const contactSheet = useOverlay(ContactPickerSheet);
  const [tokenQuery, setTokenQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const data = wallet.data;
  if (data === undefined) return null;
  const selectedToken = data.tokens.find((entry) => entry.id === data.account.sendToken) ?? null;
  const selectedContact =
    data.contacts.find((entry) => entry.id === data.account.sendContact) ?? null;
  return (
    <Card title="Transfer" description="Pick a token and a recipient, then enter the amount.">
      <div className="flex flex-col gap-5">
        <TokenSelectorContent
          value={{
            tokens: data.tokens,
            selected: data.account.sendToken,
            query: tokenQuery,
            control: tokenAct.controlProps,
            onQuery: setTokenQuery,
            onPick: (token) => {
              void tokenAct.run({ token }).then((result) => {
                if (result.ok) tokenSheet.hide();
              });
            },
          }}
        >
          <TokenField
            token={selectedToken}
            control={tokenAct.controlProps}
            sheetTrigger={tokenSheet.triggerProps}
            onNext={() => {
              void tokenAct.run({});
            }}
          />
          <TokenSelectorSheet />
        </TokenSelectorContent>
        <ContactPickerContent
          value={{
            contacts: data.contacts,
            selected: data.account.sendContact,
            query: contactQuery,
            control: contactAct.controlProps,
            onQuery: setContactQuery,
            onPick: (contact) => {
              void contactAct.run({ contact }).then((result) => {
                if (result.ok) contactSheet.hide();
              });
            },
          }}
        >
          <ContactField
            contact={selectedContact}
            control={contactAct.controlProps}
            sheetTrigger={contactSheet.triggerProps}
            onNext={() => {
              void contactAct.run({});
            }}
          />
          <ContactPickerSheet />
        </ContactPickerContent>
        <AmountField
          amount={draft.amount}
          valid={draft.valid}
          symbol={selectedToken?.symbol ?? ""}
          balance={selectedToken?.balance ?? "0"}
          priceUsd={selectedToken?.priceUsd ?? "0"}
          onAmount={draft.setAmount}
        />
      </div>
    </Card>
  );
});
