export default function Receive() {
  return (
    <form>
      <input name="address" aria-label="Address" style={{ minHeight: 44 }} />
      <input type="hidden" name="_csrf" value="token" />
    </form>
  );
}
