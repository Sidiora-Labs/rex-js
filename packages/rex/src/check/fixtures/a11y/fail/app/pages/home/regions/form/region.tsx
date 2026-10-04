import TokenFilter from "./parts/TokenFilter.tsx";

export default function FormRegion() {
  const refresh = () => undefined;
  return (
    <form>
      <img src="/logo.png" />
      <button type="button">
        <svg />
      </button>
      <a href="/help" />
      <div role="button" tabIndex={2} onClick={refresh} onKeyDown={refresh} />
      <input name="amount" />
      <label>Memo</label>
      <input type="image" src="/go.png" />
      <input type="button" />
      <input autoFocus aria-label="Search" />
      <TokenFilter />
    </form>
  );
}
