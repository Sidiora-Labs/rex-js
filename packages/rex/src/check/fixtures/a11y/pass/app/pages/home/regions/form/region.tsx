import AmountField from "./parts/AmountField.tsx";
import IconButton from "./parts/IconButton.tsx";
import RecipientField from "./parts/RecipientField.tsx";

export default function FormRegion() {
  const refresh = () => undefined;
  return (
    <form>
      <input type="hidden" name="_csrf" value="token" />
      <RecipientField />
      <AmountField />
      <img src="/divider.png" alt="" />
      <img src="/chart.png" alt="Balance over time" />
      <img src="/spacer.png" role="presentation" />
      <button type="submit">Send</button>
      <button type="button" aria-label="Close">
        <svg aria-hidden="true" />
      </button>
      <button type="button">
        <img src="/refresh.png" alt="Refresh" />
      </button>
      <button type="button">{refresh.name}</button>
      <IconButton aria-label="Help" />
      <a href="/help">
        <span>Help</span>
      </a>
      <a id="top" />
      <div role="button" tabIndex={0} onClick={refresh} onKeyDown={refresh}>
        Refresh
      </div>
      <span tabIndex={-1}>Focused from code</span>
      <input type="submit" />
      <input type="button" value="Reset filters" />
      <input type="image" src="/go.png" alt="Go" />
      <input autoFocus={false} aria-label="Search" />
    </form>
  );
}
