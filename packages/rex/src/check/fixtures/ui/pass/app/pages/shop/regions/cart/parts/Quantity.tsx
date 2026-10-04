import { Input } from "../../../../../components/ui/input.tsx";

export default function Quantity() {
  return (
    <label>
      Quantity
      <Input name="quantity" />
      <input type="hidden" name="_csrf" value="token" />
    </label>
  );
}
