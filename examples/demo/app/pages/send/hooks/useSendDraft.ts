import { useDraft } from "@sidioralabs/rex/client";
import { MONEY_PATTERN } from "@sidioralabs/rex";
import { z } from "zod/mini";

const sendDraft = z.object({ amount: z.string().check(z.maxLength(32)) });

export function useSendDraft() {
  const draft = useDraft(sendDraft);
  const amount = draft.value?.amount ?? "";
  return {
    amount,
    valid: amount === "" || MONEY_PATTERN.test(amount),
    setAmount: (next: string) => draft.set(next === "" ? null : { amount: next }),
  };
}
