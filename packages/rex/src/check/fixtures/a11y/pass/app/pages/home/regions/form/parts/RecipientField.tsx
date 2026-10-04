import { useId } from "react";

export default function RecipientField() {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>Recipient</label>
      <input id={id} name="recipient" />
      <label htmlFor="memo">Memo</label>
      <textarea id="memo" name="memo" />
    </div>
  );
}
