export default function Receive() {
  return (
    <form>
      <input name="address" aria-label="Address" style={{ height: 32 }} />
      <input type="hidden" name="_csrf" value="token" style={{ height: 1 }} />
    </form>
  );
}
