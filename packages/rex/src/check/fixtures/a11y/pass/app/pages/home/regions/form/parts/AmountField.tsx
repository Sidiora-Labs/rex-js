export default function AmountField() {
  return (
    <fieldset>
      <label>
        Amount
        <input name="amount" type="number" />
      </label>
      <select name="token" aria-label="Token">
        <option value="PAX">PAX</option>
      </select>
      <textarea name="note" title="Note" />
    </fieldset>
  );
}
