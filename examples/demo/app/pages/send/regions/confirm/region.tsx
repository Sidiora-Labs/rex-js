import { ActionForm, region } from "@sidioralabs/rex/client";
import { send } from "../../../../actions/send.ts";
import Button from "../../../../components/Button.tsx";
import { useSendDraft } from "../../hooks/useSendDraft.ts";
import { useWallet } from "../../hooks/useWallet.ts";
import SendSummary from "./parts/SendSummary.tsx";

export default region("confirm", ({ act }) => {
  const wallet = useWallet();
  const draft = useSendDraft();
  const sending = act(send);
  const data = wallet.data;
  if (data === undefined) return null;
  const token = data.tokens.find((entry) => entry.id === data.account.sendToken) ?? null;
  const contact = data.contacts.find((entry) => entry.id === data.account.sendContact) ?? null;
  return (
    <SendSummary
      symbol={token?.symbol ?? null}
      recipient={contact?.name ?? null}
      amount={draft.amount}
      valid={draft.valid}
    >
      {draft.valid ? (
        <ActionForm action={send} submitLabel="Send">
          <input type="hidden" name="amount" value={draft.amount} />
        </ActionForm>
      ) : (
        <Button {...sending.controlProps} tone="primary" disabled aria-disabled>
          Send
        </Button>
      )}
    </SendSummary>
  );
});
